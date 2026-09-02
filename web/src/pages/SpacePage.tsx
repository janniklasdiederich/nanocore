import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError, type DocMeta, type DocSpace } from "../api";
import { useAuth } from "../auth";
import { AppShell } from "../components/AppShell";
import { useI18n, useT } from "../i18n";
import { useDocumentTitle } from "../useDocumentTitle";
import { SpaceAccessDialog } from "./SpaceAccessDialog";
import { formatRelative } from "./SpacesPage";

export function SpacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const { locale } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [space, setSpace] = useState<DocSpace | null>(null);
  const [documents, setDocuments] = useState<DocMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.getSpace(id);
      setSpace(res.space);
      setDocuments(res.documents);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("spaces.openFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useDocumentTitle(space?.name ?? t("spaces.title"));

  async function createDoc() {
    if (!id) return;
    setCreating(true);
    try {
      const res = await api.createDocument(id, t("docs.defaultTitle"));
      navigate(`/docs/${res.document.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("docs.createFailed"),
      );
      setCreating(false);
    }
  }

  async function renameSpace() {
    if (!isAdmin || !space) return;
    const name = window.prompt(t("spaces.renamePrompt"), space.name);
    if (!name || name.trim() === space.name) return;
    try {
      const res = await api.renameSpace(space.id, name.trim());
      setSpace(res.space);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("spaces.renameFailed"),
      );
    }
  }

  async function renameDoc(doc: DocMeta) {
    const title = window.prompt(t("docs.renamePrompt"), doc.title);
    if (!title || title.trim() === doc.title) return;
    try {
      const res = await api.renameDocument(doc.id, title.trim());
      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? res.document : d)),
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("docs.renameFailed"),
      );
    }
  }

  async function deleteDoc(doc: DocMeta) {
    if (!window.confirm(t("docs.deleteConfirm", { name: doc.title }))) return;
    try {
      await api.deleteDocument(doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("docs.deleteFailed"),
      );
    }
  }

  if (!id) {
    return (
      <AppShell>
        <div className="empty-state">{t("board.missingId")}</div>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell title={t("spaces.title")}>
        <div className="center-screen" style={{ minHeight: 240 }}>
          <div className="spinner" />
        </div>
      </AppShell>
    );
  }

  if (error && !space) {
    return (
      <AppShell title={t("spaces.title")}>
        <div className="auth-card" style={{ margin: "40px auto" }}>
          <h1>{t("spaces.openFailed")}</h1>
          <p className="subtitle">{error}</p>
          <Link className="btn btn-primary" to="/spaces">
            {t("spaces.back")}
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <p className="crumb">
            <Link to="/spaces">{t("spaces.title")}</Link>
          </p>
          <h1>{space?.name ?? t("spaces.title")}</h1>
          <p>{t("spaces.subtitle")}</p>
        </div>
        <div className="page-header-actions">
          {isAdmin && space && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: "auto" }}
                onClick={() => setAccessOpen(true)}
              >
                {t("boards.access")}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: "auto" }}
                onClick={() => void renameSpace()}
              >
                {t("common.rename")}
              </button>
            </>
          )}
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "auto" }}
            disabled={creating}
            onClick={() => void createDoc()}
          >
            {creating ? t("docs.creating") : t("docs.new")}
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {documents.length === 0 ? (
        <div className="empty-state">
          <p>{t("docs.empty")}</p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "auto", marginTop: 12 }}
            disabled={creating}
            onClick={() => void createDoc()}
          >
            {t("docs.createFirst")}
          </button>
        </div>
      ) : (
        <div className="board-grid">
          {documents.map((doc) => (
            <article key={doc.id} className="board-card">
              <button
                type="button"
                className="board-card-delete"
                title={t("common.delete")}
                aria-label={t("common.delete")}
                onClick={() => void deleteDoc(doc)}
              >
                ×
              </button>
              <div>
                <h3>{doc.title}</h3>
                <div className="meta">
                  {t("spaces.updated", {
                    date: formatRelative(doc.updatedAt, locale),
                  })}
                </div>
              </div>
              <div className="actions">
                <Link
                  className="btn btn-primary btn-sm"
                  to={`/docs/${doc.id}`}
                >
                  {t("common.open")}
                </Link>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void renameDoc(doc)}
                >
                  {t("common.rename")}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {accessOpen && space && (
        <SpaceAccessDialog
          space={space}
          onClose={() => setAccessOpen(false)}
        />
      )}
    </AppShell>
  );
}
