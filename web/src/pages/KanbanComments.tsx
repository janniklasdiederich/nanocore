import { useMemo, useState, type KeyboardEvent } from "react";
import { ApiError, api, type KanbanComment } from "../api";
import { useAuth } from "../auth";
import { avatarColor, formatStamp, initials } from "../kanbanDisplay";
import { useI18n, useT } from "../i18n";

export function KanbanCommentThread({
  boardId,
  cardId,
  comments,
  variant,
}: {
  boardId: string;
  cardId: string;
  comments: KanbanComment[];
  variant: "page" | "canvas";
}) {
  const t = useT();
  const { locale } = useI18n();
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ns = variant === "page" ? "kb" : "nc-kb";
  const ordered = useMemo(
    () =>
      [...comments].sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
      ),
    [comments],
  );

  async function post() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.addKanbanComment(boardId, cardId, body);
      setDraft("");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("kanban.comment.failed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(commentId: string) {
    if (!window.confirm(t("kanban.comment.delete"))) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteKanbanComment(boardId, cardId, commentId);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("kanban.comment.failed"),
      );
    } finally {
      setBusy(false);
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void post();
    }
  }

  return (
    <div className={`${ns}-comments`}>
      <div className={`${ns}-comments-head`}>
        {t("kanban.comments")}
        {ordered.length > 0 ? (
          <span className="kb-col-count">{ordered.length}</span>
        ) : null}
      </div>
      {ordered.length === 0 ? (
        <p className={`${ns}-comments-empty`}>{t("kanban.comment.empty")}</p>
      ) : (
        <ul className={`${ns}-comment-list`}>
          {ordered.map((c) => {
            const name = c.authorName || t("kanban.comment.deletedUser");
            const canDelete =
              !!user && (user.id === c.authorId || user.role === "admin");
            return (
              <li key={c.id} className={`${ns}-comment`}>
                <span
                  className={variant === "page" ? "kb-avatar" : "nc-kb-avatar"}
                  title={name}
                  style={{
                    background: c.authorId ? avatarColor(c.authorId) : undefined,
                  }}
                >
                  {initials(name)}
                </span>
                <div className={`${ns}-comment-main`}>
                  <div className={`${ns}-comment-meta`}>
                    <strong>{name}</strong>
                    <time dateTime={c.createdAt}>
                      {formatStamp(c.createdAt, locale)}
                    </time>
                    {canDelete ? (
                      <button
                        type="button"
                        className={
                          variant === "page"
                            ? "kb-icon-btn kb-icon-btn--danger"
                            : "nc-kb-comment-del"
                        }
                        title={t("common.delete")}
                        disabled={busy}
                        onClick={() => void remove(c.id)}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                  <div className={`${ns}-comment-body`}>{c.body}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {error ? <p className={`${ns}-comments-error`}>{error}</p> : null}
      <div className={`${ns}-comment-compose`}>
        <textarea
          className={variant === "page" ? "kb-textarea" : "nc-kb-tl-input nc-kb-tl-input--area"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder={t("kanban.comment.placeholder")}
          maxLength={4000}
          rows={2}
        />
        <button
          type="button"
          className={
            variant === "page" ? "btn btn-secondary btn-sm" : "nc-kb-comment-post"
          }
          disabled={busy || !draft.trim()}
          onClick={() => void post()}
        >
          {t("kanban.comment.post")}
        </button>
      </div>
    </div>
  );
}
