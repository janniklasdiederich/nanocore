import { useCallback, useEffect, useRef, useState } from "react";
import {
  AssetRecordType,
  TldrawUiButton,
  TldrawUiButtonLabel,
  TldrawUiDialogBody,
  TldrawUiDialogCloseButton,
  TldrawUiDialogHeader,
  TldrawUiDialogTitle,
  createShapeId,
  useEditor,
  type TLUiDialogProps,
} from "tldraw";
import { ApiError, api, type GifHit } from "../api";
import { apiOrigin } from "../config";
import { useT } from "../i18n";

/**
 * Discord-style GIF search. Choosing a result downloads a copy to Nanocore
 * and places an animated image on the current page (autoplay + loop).
 */
export function GifPickerDialog({ onClose }: TLUiDialogProps) {
  const editor = useEditor();
  const t = useT();
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GifHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.searchGifs(q, 0);
      setGifs(res.gifs);
    } catch (err) {
      const message =
        err instanceof ApiError && err.code === "GIPHY_NOT_CONFIGURED"
          ? t("gifs.notConfigured")
          : err instanceof Error
            ? err.message
            : t("gifs.loadFailed");
      setError(message);
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load("");
  }, [load]);

  function onQueryChange(value: string) {
    setQuery(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      void load(value.trim());
    }, 280);
  }

  async function pick(gif: GifHit) {
    if (importingId) return;
    setImportingId(gif.id);
    setError(null);
    try {
      const imported = await api.importGif(gif.id);
      const base = apiOrigin() || window.location.origin;
      const src = new URL(imported.src, base).href;

      const maxEdge = Math.min(360, editor.getViewportPageBounds().w * 0.45);
      const scale = Math.min(1, maxEdge / Math.max(imported.w, imported.h));
      const w = Math.max(40, imported.w * scale);
      const h = Math.max(40, imported.h * scale);
      const center = editor.getViewportPageBounds().center;

      const assetId = AssetRecordType.createId();
      editor.run(() => {
        editor.markHistoryStoppingPoint("insert gif");
        editor.createAssets([
          {
            id: assetId,
            typeName: "asset",
            type: "image",
            props: {
              name: imported.name || "gif",
              src,
              w: imported.w,
              h: imported.h,
              mimeType: imported.mimeType || "image/gif",
              isAnimated: true,
            },
            meta: {},
          },
        ]);
        editor.createShape({
          id: createShapeId(),
          type: "image",
          x: center.x - w / 2,
          y: center.y - h / 2,
          props: {
            w,
            h,
            assetId,
          },
        });
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("gifs.importFailed"));
    } finally {
      setImportingId(null);
    }
  }

  return (
    <>
      <TldrawUiDialogHeader>
        <TldrawUiDialogTitle>{t("gifs.title")}</TldrawUiDialogTitle>
        <TldrawUiDialogCloseButton />
      </TldrawUiDialogHeader>
      <TldrawUiDialogBody className="nc-gif-dialog">
        <input
          className="nc-gif-search"
          type="search"
          value={query}
          autoFocus
          placeholder={t("gifs.searchPlaceholder")}
          aria-label={t("gifs.searchPlaceholder")}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        {error && <p className="nc-gif-error">{error}</p>}
        {loading && <p className="nc-gif-status">{t("common.loading")}</p>}
        {!loading && !error && gifs.length === 0 && (
          <p className="nc-gif-status">{t("gifs.empty")}</p>
        )}
        <div className="nc-gif-grid" role="list">
          {gifs.map((gif) => (
            <TldrawUiButton
              key={gif.id}
              type="normal"
              className="nc-gif-cell"
              disabled={importingId !== null}
              title={gif.title}
              onClick={() => void pick(gif)}
            >
              <img src={gif.previewUrl} alt={gif.title} loading="lazy" />
              {importingId === gif.id && (
                <span className="nc-gif-cell-busy">
                  <TldrawUiButtonLabel>{t("gifs.adding")}</TldrawUiButtonLabel>
                </span>
              )}
            </TldrawUiButton>
          ))}
        </div>
      </TldrawUiDialogBody>
    </>
  );
}
