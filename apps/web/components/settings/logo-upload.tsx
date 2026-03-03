"use client";

import { useState, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@inkloom/ui/button";
import { Label } from "@inkloom/ui/label";
import { Upload, X, ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";

interface LogoUploadProps {
  projectId: Id<"projects">;
  assetId?: Id<"assets">;
  onUpload: (assetId: Id<"assets">) => void;
  onRemove: () => void;
}

export function LogoUpload({
  projectId,
  assetId,
  onUpload,
  onRemove,
}: LogoUploadProps) {
  const t = useTranslations("settings");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createAsset = useMutation(api.assets.createAsset);
  const deleteAsset = useMutation(api.assets.deleteAsset);
  const asset = useQuery(
    api.assets.getAsset,
    assetId ? { assetId } : "skip"
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/svg+xml", "image/png", "image/jpeg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError(t("logoUpload.invalidType"));
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError(t("logoUpload.fileTooLarge"));
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      // Get presigned URL from our API
      const presignResponse = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          projectId,
        }),
      });

      if (!presignResponse.ok) {
        throw new Error("Failed to get presigned URL");
      }

      const { presignedUrl, r2Key, publicUrl } = await presignResponse.json();

      // Upload file directly to R2
      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      // Create asset record
      const { assetId: newAssetId } = await createAsset({
        projectId,
        r2Key,
        url: publicUrl,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      });

      // Delete old asset if exists
      if (assetId) {
        const { r2Key: oldR2Key } = await deleteAsset({ assetId });
        if (oldR2Key) {
          await fetch("/api/upload/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ r2Key: oldR2Key }),
          });
        }
      }

      onUpload(newAssetId);
    } catch (err) {
      console.error("Upload error:", err);
      setError(t("logoUpload.uploadFailed"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = async () => {
    if (assetId) {
      try {
        const { r2Key } = await deleteAsset({ assetId });
        if (r2Key) {
          await fetch("/api/upload/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ r2Key }),
          });
        }
        onRemove();
      } catch (err) {
        console.error("Delete error:", err);
        setError(t("logoUpload.removeFailed"));
      }
    }
  };

  return (
    <div className="space-y-3">
      <Label>{t("logoUpload.label")}</Label>

      {asset?.url ? (
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-lg border bg-muted p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.url}
              alt={t("logoUpload.preview")}
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{asset.filename}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Upload className="mr-2 h-4 w-4" />
                {t("logoUpload.replace")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemove}
              >
                <X className="mr-2 h-4 w-4" />
                {t("logoUpload.remove")}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 p-8 transition-colors hover:border-muted-foreground/50 hover:bg-muted"
        >
          <ImageIcon className="mb-2 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">
            {isUploading ? t("logoUpload.uploading") : t("logoUpload.clickToUpload")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("logoUpload.formats")}
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
