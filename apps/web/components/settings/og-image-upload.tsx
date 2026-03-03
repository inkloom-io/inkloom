"use client";

import { useState, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@inkloom/ui/button";
import { Label } from "@inkloom/ui/label";
import { Upload, X, ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";

interface OgImageUploadProps {
  projectId: Id<"projects">;
  assetId?: Id<"assets">;
  onUpload: (assetId: Id<"assets">) => void;
  onRemove: () => void;
  label?: string;
}

export function OgImageUpload({
  projectId,
  assetId,
  onUpload,
  onRemove,
  label,
}: OgImageUploadProps) {
  const t = useTranslations("settings");
  const resolvedLabel = label ?? t("ogImageUpload.label");
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

    const validTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError(t("ogImageUpload.invalidType"));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError(t("ogImageUpload.fileTooLarge"));
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const presignResponse = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          projectId,
        }),
      });

      if (!presignResponse.ok) throw new Error("Failed to get presigned URL");

      const { presignedUrl, r2Key, publicUrl } = await presignResponse.json();

      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResponse.ok) throw new Error("Upload failed");

      const { assetId: newAssetId } = await createAsset({
        projectId,
        r2Key,
        url: publicUrl,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      });

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
      setError(t("ogImageUpload.uploadFailed"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
        setError(t("ogImageUpload.removeFailed"));
      }
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-medium">{resolvedLabel}</Label>
        <p className="text-xs text-muted-foreground mt-1">
          {t("ogImageUpload.description")}
        </p>
      </div>

      {asset?.url ? (
        <div className="space-y-3">
          <div className="rounded-lg border overflow-hidden" style={{ aspectRatio: "1200/630", maxWidth: 400 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.url}
              alt={t("ogImageUpload.preview")}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload className="mr-2 h-3 w-3" />
              {t("ogImageUpload.replace")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemove}
            >
              <X className="mr-2 h-3 w-3" />
              {t("ogImageUpload.remove")}
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 transition-colors hover:border-muted-foreground/50 hover:bg-muted"
          style={{ aspectRatio: "1200/630", maxWidth: 400 }}
        >
          <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">
            {isUploading ? t("ogImageUpload.uploading") : t("ogImageUpload.clickToUpload")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("ogImageUpload.formats")}
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
