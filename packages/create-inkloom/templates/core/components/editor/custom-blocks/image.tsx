"use client";

import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ImagePlus, AlertCircle } from "lucide-react";
import "./image.css";

export const CustomImage = createReactBlockSpec(
  {
    type: "image" as const,
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      backgroundColor: defaultProps.backgroundColor,
      name: {
        default: "" as const,
      },
      url: {
        default: "" as const,
      },
      caption: {
        default: "" as const,
      },
      showPreview: {
        default: true,
      },
      previewWidth: {
        default: undefined as undefined | number,
        type: "number" as const,
      },
      alt: {
        default: "" as const,
      },
    },
    content: "none" as const,
  },
  {
    meta: {
      fileBlockAccept: ["image/*"],
    },
    render: (props) => {
      const { url, alt, caption, name, previewWidth } = props.block.props;
      const [isEditingAlt, setIsEditingAlt] = useState(false);
      const altInputRef = useRef<HTMLInputElement>(null);

      // Upload state
      const [isUploading, setIsUploading] = useState(false);
      const [uploadingFile, setUploadingFile] = useState<File | null>(null);
      const [uploadError, setUploadError] = useState<string | null>(null);
      const uploadCancelledRef = useRef(false);

      // Create a preview URL for the uploading file
      const previewUrl = useMemo(() => {
        if (uploadingFile) {
          return URL.createObjectURL(uploadingFile);
        }
        return null;
      }, [uploadingFile]);

      // Clean up the object URL when the file changes or upload completes
      useEffect(() => {
        return () => {
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
          }
        };
      }, [previewUrl]);

      // Focus the alt input when entering edit mode
      useEffect(() => {
        if (isEditingAlt && altInputRef.current) {
          altInputRef.current.focus();
        }
      }, [isEditingAlt]);

      const handleAltChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
          props.editor.updateBlock(props.block, {
            props: { alt: e.target.value },
          });
        },
        [props.editor, props.block],
      );

      const handleAltKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter") {
            setIsEditingAlt(false);
          }
          // Prevent BlockNote from handling these keys when typing alt text
          e.stopPropagation();
        },
        [],
      );

      const [isDragOver, setIsDragOver] = useState(false);
      const fileInputRef = useRef<HTMLInputElement>(null);

      const handleFile = useCallback(
        async (file: File) => {
          if (!file.type.startsWith("image/")) return;
          const editor = props.editor as any;
          if (editor.uploadFile) {
            setIsUploading(true);
            setUploadingFile(file);
            setUploadError(null);
            uploadCancelledRef.current = false;
            try {
              const uploadedUrl = await editor.uploadFile(file);
              if (uploadCancelledRef.current) return;
              props.editor.updateBlock(props.block, {
                props: { url: uploadedUrl, name: file.name },
              });
            } catch {
              if (!uploadCancelledRef.current) {
                setUploadError("Failed to upload image");
              }
            } finally {
              if (!uploadCancelledRef.current) {
                setIsUploading(false);
              }
            }
          }
        },
        [props.editor, props.block],
      );

      // Listen for custom event dispatched by the custom file panel.
      useEffect(() => {
        const editorEl = (props.editor as any).domElement as HTMLElement | null;
        if (!editorEl) return;

        const onImageUpload = (e: Event) => {
          const ce = e as CustomEvent<{ blockId: string; file: File }>;
          if (ce.detail.blockId === props.block.id) {
            handleFile(ce.detail.file);
          }
        };

        editorEl.addEventListener("bn-image-upload", onImageUpload);
        return () => {
          editorEl.removeEventListener("bn-image-upload", onImageUpload);
        };
      }, [props.editor, props.block.id, handleFile]);

      const handleCancel = useCallback(() => {
        uploadCancelledRef.current = true;
        setIsUploading(false);
        setUploadingFile(null);
        setUploadError(null);
      }, []);

      const handleRetry = useCallback(() => {
        if (uploadingFile) {
          handleFile(uploadingFile);
        }
      }, [uploadingFile, handleFile]);

      const handleChooseDifferent = useCallback(() => {
        setUploadError(null);
        setUploadingFile(null);
        fileInputRef.current?.click();
      }, []);

      const handleDrop = useCallback(
        (e: React.DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        },
        [handleFile],
      );

      const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
      }, []);

      const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
      }, []);

      const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
      }, []);

      const handleFileInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        },
        [handleFile],
      );

      // Error state
      if (uploadError && !isUploading) {
        return (
          <div className="bn-image-block">
            <div className="bn-image-error-container">
              {previewUrl && (
                <div
                  className="bn-image-uploading-preview"
                  style={{ backgroundImage: `url(${previewUrl})` }}
                />
              )}
              <div className="bn-image-error-content">
                <AlertCircle className="bn-image-error-icon" size={28} />
                <span className="bn-image-error-message">{uploadError}</span>
                <div className="bn-image-error-actions">
                  <button
                    type="button"
                    className="bn-image-error-retry"
                    onClick={handleRetry}
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    className="bn-image-error-choose"
                    onClick={handleChooseDifferent}
                  >
                    Choose different file
                  </button>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                className="bn-image-drop-target-input"
                tabIndex={-1}
              />
            </div>
          </div>
        );
      }

      // Uploading state
      if (isUploading && uploadingFile) {
        const displayName =
          uploadingFile.name.length > 40
            ? `${uploadingFile.name.slice(0, 37)}...`
            : uploadingFile.name;
        return (
          <div className="bn-image-block">
            <div className="bn-image-uploading-container">
              {previewUrl && (
                <div
                  className="bn-image-uploading-preview"
                  style={{ backgroundImage: `url(${previewUrl})` }}
                />
              )}
              <div className="bn-image-uploading-overlay">
                <div className="bn-image-uploading-progress-track">
                  <div className="bn-image-uploading-progress-fill" />
                </div>
                <div className="bn-image-uploading-footer">
                  <span className="bn-image-uploading-status">
                    Uploading image... {displayName}
                  </span>
                  <button
                    type="button"
                    className="bn-image-uploading-cancel"
                    onClick={handleCancel}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      }

      // Empty state (no URL, not uploading)
      if (!url) {
        return (
          <div className="bn-image-block">
            <div
              className={`bn-image-drop-target${isDragOver ? " bn-image-drop-target--active" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <ImagePlus className="bn-image-drop-target-icon" size={32} />
              <span className="bn-image-drop-target-text">
                Drop image here or click to upload
              </span>
              <span className="bn-image-drop-target-hint">
                PNG, JPG, GIF, WebP, SVG
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                className="bn-image-drop-target-input"
                tabIndex={-1}
              />
            </div>
          </div>
        );
      }

      return (
        <div className="bn-image-block">
          <div className="bn-image-wrapper">
            <img
              src={url}
              alt={alt || name || caption || "Image"}
              className="bn-image"
              style={
                previewWidth
                  ? { width: `${previewWidth}px`, maxWidth: "100%" }
                  : undefined
              }
              draggable={false}
            />
          </div>
          <div className="bn-image-alt-row">
            <button
              className="bn-image-alt-badge"
              onClick={() => setIsEditingAlt(!isEditingAlt)}
              contentEditable={false}
              type="button"
            >
              {alt ? "ALT" : "+ ALT"}
            </button>
            {isEditingAlt && (
              <input
                ref={altInputRef}
                className="bn-image-alt-input"
                value={alt}
                onChange={handleAltChange}
                onKeyDown={handleAltKeyDown}
                onBlur={() => setIsEditingAlt(false)}
                placeholder="Describe this image..."
                contentEditable={false}
              />
            )}
          </div>
        </div>
      );
    },
  },
);
