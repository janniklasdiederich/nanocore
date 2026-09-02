import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, type DocSpace } from "../api";
import { useAuth } from "../auth";
import { AppShell } from "../components/AppShell";
import { useI18n, useT } from "../i18n";
import { useDocumentTitle } from "../useDocumentTitle";
import { SpaceAccessDialog } from "./SpaceAccessDialog";

export function SpacesPage() {
  const navigate = useNavigate();
  const t = useT();
  const { locale } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [spaces, setSpaces] = useState<DocSpace[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [accessFor, setAccessFor] = useState<DocSpace | null>(null);
  const [deleteFor, setDeleteFor] = useState<DocSpace | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.listSpaces();
      setSpaces(res.spaces);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("spaces.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useDocumentTitle(t("spaces.title"));

  async function createSpace() {
    if (!isAdmin) return;
    setCreating(true);
    try {
      const res = await api.createSpace(t("spaces.defaultName"));
      navigate(`/spaces/${res.space.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("spaces.createFailed"),
      );
      setCreating(false);
    }
  }

  async function renameSpace(space: DocSpace) {
    if (!isAdmin) return;
    const name = window.prompt(t("spaces.renamePrompt"), space.name);
    if (!name || name.trim() === space.name) return;
    try {
      const res = await api.renameSpace(space.id, name.trim());
      setSpaces((prev) =>
        prev.map((s) => (s.id === space.id ? res.space : s)),
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("spaces.renameFailed"),
      );
    }
  }

  async function confirmDelete(space: DocSpace) {
    if (!isAdmin) return;
    try {
      await api.deleteSpace(space.id);
      setSpaces((prev) => prev.filter((s) => s.id !== space.id));
      setDeleteFor(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("spaces.deleteFailed"),
      );
    }
  }

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1>{t("spaces.title")}</h1>
          <p>{t("spaces.subtitle")}</p>
        </div>
        {isAdmin && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "auto" }}
            disabled={creating}
            onClick={() => void createSpace()}
          >
            {creating ? t("spaces.creating") : t("spaces.new")}
          </button>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="center-screen" style={{ minHeight: 200 }}>
          <div className="spinner" />
        </div>
      ) : spaces.length === 0 ? (
        <div className="empty-state">
          <p>{isAdmin ? t("spaces.empty") : t("spaces.emptyMember")}</p>
          {isAdmin && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "auto", marginTop: 12 }}
              onClick={() => void createSpace()}
            >
              {t("spaces.createFirst")}
            </button>
          )}
        </div>
      ) : (
        <div className="board-grid">
          {spaces.map((space) => (
            <article key={space.id} className="board-card">
              {isAdmin && (
                <button
                  type="button"
                  className="board-card-delete"
                  title={t("common.delete")}
                  aria-label={t("common.delete")}
                  onClick={() => setDeleteFor(space)}
                >
                  ×
                </button>
              )}
              <div>
                <h3>{space.name}</h3>
                <div className="meta">
                  {t("spaces.docCount", { count: space.documentCount })}
                  {" · "}
                  {t("spaces.updated", {
                    date: formatRelative(space.updatedAt, locale),
                  })}
                </div>
              </div>
              <div className="actions">
                <Link
                  className="btn btn-primary btn-sm"
                  to={`/spaces/${space.id}`}
                >
                  {t("common.open")}
                </Link>
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setAccessFor(space)}
                    >
                      {t("boards.access")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => void renameSpace(space)}
                    >
                      {t("common.rename")}
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {accessFor && (
        <SpaceAccessDialog
          space={accessFor}
          onClose={() => setAccessFor(null)}
        />
      )}
      {deleteFor && (
        <SpaceDeleteDialog
          space={deleteFor}
          onClose={() => setDeleteFor(null)}
          onConfirm={() => confirmDelete(deleteFor)}
        />
      )}
    </AppShell>
  );
}

function SpaceDeleteDialog({
  space,
  onClose,
  onConfirm,
}: {
  space: DocSpace;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const t = useT();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = typed.trim() === space.name;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!matches || busy) return;
    setBusy(true);
    await onConfirm();
    setBusy(false);
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="space-delete-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="modal" onSubmit={(e) => void submit(e)}>
        <h2 id="space-delete-title">
          {t("spaces.deleteTitle", { name: space.name })}
        </h2>
        <p>{t("spaces.deleteHelp")}</p>
        <div className="field">
          <label htmlFor="space-delete-name">
            {t("spaces.deleteTypeName")}
          </label>
          <input
            id="space-delete-name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoFocus
          />
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            className="btn btn-danger btn-sm"
            style={{ width: "auto" }}
            disabled={!matches || busy}
          >
            {busy ? t("common.deleting") : t("common.delete")}
          </button>
        </div>
      </form>
    </div>
  );
}

export function formatRelative(iso: string, locale: string): string {
  const date = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(locale === "de" ? "de-DE" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
