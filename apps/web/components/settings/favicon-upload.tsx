"use client";

import { useState, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@inkloom/ui/button";
import { Label } from "@inkloom/ui/label";
import { Upload, X, ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";

interface FaviconUploadProps {
  projectId: Id<"projects">;
  assetId?: Id<"assets">;
  onUpload: (assetId: Id<"assets">) => void;
  onRemove: () => void;
}

export function FaviconUpload({
  projectId,
  assetId,
  onUpload,
  onRemove,
}: FaviconUploadProps) {
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

    const validTypes = [
      "image/x-icon",
      "image/vnd.microsoft.icon",
      "image/png",
      "image/svg+xml",
    ];
    if (!validTypes.includes(file.type)) {
      setError(t("faviconUpload.invalidType"));
      return;
    }

    if (file.size > 512 * 1024) {
      setError(t("faviconUpload.fileTooLarge"));
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
      setError(t("faviconUpload.uploadFailed"));
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
        setError(t("faviconUpload.removeFailed"));
      }
    }
  };

  return (
    <div className="space-y-3">
      <Label>{t("faviconUpload.label")}</Label>

      {asset?.url ? (
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.url}
              alt={t("faviconUpload.preview")}
              className="h-8 w-8 object-contain"
            />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">{asset.filename}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Upload className="mr-2 h-3 w-3" />
                {t("faviconUpload.replace")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemove}
              >
                <X className="mr-2 h-3 w-3" />
                {t("faviconUpload.remove")}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 p-4 transition-colors hover:border-muted-foreground/50 hover:bg-muted"
        >
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">
              {isUploading ? t("faviconUpload.uploading") : t("faviconUpload.clickToUpload")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("faviconUpload.formats")}
            </p>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".ico,.png,.svg,image/x-icon,image/vnd.microsoft.icon,image/png,image/svg+xml"
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
