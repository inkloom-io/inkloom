"use client";

/**
 * Custom file panel that closes immediately on image upload and delegates
 * to the image block's in-block loading state (blurred preview + shimmer).
 *
 * For non-image blocks the default upload behaviour is preserved.
 * The Embed tab works as-is.
 */

import { FilePanelExtension } from "@blocknote/core/extensions";
import {
  useBlockNoteEditor,
  EmbedTab,
} from "@blocknote/react";
import { useCallback, useEffect, useState } from "react";
import { useComponentsContext } from "@blocknote/react";
import { useDictionary } from "@blocknote/react";
import type { FilePanelProps } from "@blocknote/react";

// ── Custom Upload Tab ────────────────────────────────────────────────
// For image blocks: dispatch a DOM event so the image block's own
// `handleFile` runs, then close the panel immediately.
// For other block types: fall back to the default upload behaviour.

function CustomUploadTab(
  props: FilePanelProps & { setLoading: (loading: boolean) => void },
) {
  const Components = useComponentsContext()!;
  const dict = useDictionary();
  const editor = useBlockNoteEditor<any, any, any>();
  const block = editor.getBlock(props.blockId)!;

  const [uploadFailed, setUploadFailed] = useState(false);

  useEffect(() => {
    if (uploadFailed) {
      const timer = setTimeout(() => setUploadFailed(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [uploadFailed]);

  const handleFileChange = useCallback(
    (file: File | null) => {
      if (!file) return;

      // For image blocks, delegate to the in-block loading UI
      if (block.type === "image") {
        // Dispatch custom event that the image block listens for
        const editorEl = editor.domElement;
        if (editorEl) {
          const blockEl = editorEl.querySelector(
            `.bn-block-outer[data-id="${props.blockId}"]`,
          );
          const target = blockEl ?? editorEl;
          target.dispatchEvent(
            new CustomEvent("bn-image-upload", {
              bubbles: true,
              detail: { blockId: props.blockId, file },
            }),
          );
        }

        // Close the file panel immediately
        const filePanel = editor.getExtension(FilePanelExtension);
        if (filePanel) {
          filePanel.closeMenu();
        }
        return;
      }

      // Non-image blocks: default behaviour (upload in-panel)
      async function upload(file: File) {
        props.setLoading(true);
        if (editor.uploadFile) {
          try {
            let updateData = await editor.uploadFile(file, props.blockId);
            if (typeof updateData === "string") {
              updateData = { props: { name: file.name, url: updateData } };
            }
            editor.updateBlock(props.blockId, updateData);
          } catch {
            setUploadFailed(true);
          } finally {
            props.setLoading(false);
          }
        }
      }
      upload(file);
    },
    [props.blockId, editor, props.setLoading, block.type],
  );

  const spec = editor.schema.blockSpecs[block.type] as
    | { implementation: { meta?: { fileBlockAccept?: string[] } } }
    | undefined;
  const accept =
    spec?.implementation.meta?.fileBlockAccept?.length
      ? spec.implementation.meta.fileBlockAccept.join(",")
      : "*/*";

  const placeholder: string =
    (dict.file_panel.upload.file_placeholder as Record<string, string>)[
      block.type
    ] ??
    (dict.file_panel.upload.file_placeholder as Record<string, string>)[
      "file"
    ] ??
    "Upload File";

  return (
    <Components.FilePanel.TabPanel className="bn-tab-panel">
      <Components.FilePanel.FileInput
        className="bn-file-input"
        data-test="upload-input"
        accept={accept}
        placeholder={placeholder}
        value={null}
        onChange={handleFileChange}
      />
      {uploadFailed && (
        <div className="bn-error-text">
          {dict.file_panel.upload.upload_error}
        </div>
      )}
    </Components.FilePanel.TabPanel>
  );
}

// ── Custom File Panel ────────────────────────────────────────────────

export function CustomFilePanel(props: FilePanelProps) {
  const Components = useComponentsContext()!;
  const dict = useDictionary();
  const editor = useBlockNoteEditor<any, any, any>();

  const [loading, setLoading] = useState(false);

  const tabs = [
    ...(editor.uploadFile
      ? [
          {
            name: dict.file_panel.upload.title,
            tabPanel: (
              <CustomUploadTab
                blockId={props.blockId}
                setLoading={setLoading}
              />
            ),
          },
        ]
      : []),
    {
      name: dict.file_panel.embed.title,
      tabPanel: <EmbedTab blockId={props.blockId} />,
    },
  ];

  const [openTab, setOpenTab] = useState(tabs[0]?.name ?? "");

  return (
    <Components.FilePanel.Root
      className="bn-panel"
      defaultOpenTab={openTab}
      openTab={openTab}
      setOpenTab={setOpenTab}
      tabs={tabs}
      loading={loading}
    />
  );
}
