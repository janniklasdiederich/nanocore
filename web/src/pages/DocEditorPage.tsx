import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import { api, ApiError, type DocMeta } from "../api";
import { useAuth } from "../auth";
import { AppShell } from "../components/AppShell";
import { apiUrl } from "../config";
import { connectDocSync, type DocSyncStatus } from "../docSync";
import { useT } from "../i18n";
import { avatarColor } from "../kanbanDisplay";
import { useDocumentTitle } from "../useDocumentTitle";

export function DocEditorPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const [meta, setMeta] = useState<{
    document: DocMeta;
    space: { id: string; name: string };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void api
      .getDocument(id)
      .then((res) => {
        setMeta(res);
        setError(null);
      })
      .catch((err: Error) => {
        setError(err instanceof ApiError ? err.message : t("docs.openFailed"));
      });
  }, [id, t]);

  useDocumentTitle(meta?.document.title ?? t("docs.loadingName"));

  if (!id) {
    return (
      <AppShell>
        <div className="empty-state">{t("board.missingId")}</div>
      </AppShell>
    );
  }

  if (error && !meta) {
    return (
      <AppShell title={t("spaces.title")}>
        <div className="auth-card" style={{ margin: "40px auto" }}>
          <h1>{t("docs.openFailed")}</h1>
          <p className="subtitle">{error}</p>
          <RouterLink className="btn btn-primary" to="/spaces">
            {t("spaces.back")}
          </RouterLink>
        </div>
      </AppShell>
    );
  }

  if (!meta) {
    return (
      <AppShell title={t("docs.loadingName")} wide>
        <div className="center-screen" style={{ minHeight: 240 }}>
          <div className="spinner" />
        </div>
      </AppShell>
    );
  }

  return (
    <LiveDoc
      key={id}
      docId={id}
      initialTitle={meta.document.title}
      space={meta.space}
    />
  );
}

function LiveDoc({
  docId,
  initialTitle,
  space,
}: {
  docId: string;
  initialTitle: string;
  space: { id: string; name: string };
}) {
  const t = useT();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState<DocSyncStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [collab, setCollab] = useState<{
    ydoc: Y.Doc;
    awareness: awarenessProtocol.Awareness;
  } | null>(null);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useDocumentTitle(title);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(ydoc);
    setCollab({ ydoc, awareness });
    const stop = connectDocSync({
      docId,
      ydoc,
      awareness,
      onStatus: setStatus,
      onSynced: () => {},
    });
    return () => {
      stop();
      awareness.destroy();
      ydoc.destroy();
    };
  }, [docId]);

  function scheduleTitle(next: string) {
    setTitle(next);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => {
      const trimmed = next.trim();
      if (!trimmed) return;
      void api.renameDocument(docId, trimmed).catch((err: Error) => {
        setError(
          err instanceof ApiError ? err.message : t("docs.titleFailed"),
        );
      });
    }, 400);
  }

  useEffect(() => {
    return () => {
      if (titleTimer.current) clearTimeout(titleTimer.current);
    };
  }, []);

  async function removeDoc() {
    if (!window.confirm(t("docs.deleteConfirm", { name: title }))) return;
    try {
      await api.deleteDocument(docId);
      navigate(`/spaces/${space.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("docs.deleteFailed"),
      );
    }
  }

  const statusLabel =
    status === "connected"
      ? t("docs.live")
      : status === "connecting"
        ? t("docs.connecting")
        : t("docs.offline");

  return (
    <AppShell title={title} wide>
      <div className="doc-page">
        <div className="doc-toolbar">
          <div className="doc-toolbar-lead">
            <RouterLink className="doc-back" to={`/spaces/${space.id}`}>
              ← {space.name}
            </RouterLink>
            <input
              className="doc-title"
              value={title}
              onChange={(e) => scheduleTitle(e.target.value)}
              onBlur={() => {
                const trimmed = title.trim();
                if (!trimmed) setTitle(initialTitle);
              }}
              aria-label={t("docs.renamePrompt")}
            />
          </div>
          <div className="doc-toolbar-tools">
            <span
              className={
                "doc-status" + (status === "connected" ? " is-live" : "")
              }
            >
              {statusLabel}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void removeDoc()}
            >
              {t("common.delete")}
            </button>
          </div>
        </div>
        {error && <div className="error-banner doc-error">{error}</div>}
        {collab && user ? (
          <DocTiptap
            ydoc={collab.ydoc}
            awareness={collab.awareness}
            user={{ id: user.id, name: user.displayName }}
          />
        ) : (
          <div className="center-screen" style={{ minHeight: 200 }}>
            <div className="spinner" />
          </div>
        )}
      </div>
    </AppShell>
  );
}

function DocTiptap({
  ydoc,
  awareness,
  user,
}: {
  ydoc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  user: { id: string; name: string };
}) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const color = avatarColor(user.id);

  const extensions = useMemo(
    () => [
      StarterKit.configure({ history: false }),
      Placeholder.configure({ placeholder: t("docs.placeholder") }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({
        provider: { awareness },
        user: { name: user.name, color },
      }),
    ],
    [ydoc, awareness, user.name, color, t],
  );

  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "doc-prose" },
    },
    onTransaction: () => rerender(),
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = String(editor.getAttributes("link").href ?? "");
    const url = window.prompt(t("docs.linkPrompt"), prev || "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url.trim() })
      .run();
  }, [editor, t]);

  async function onPickImage(file: File) {
    if (!editor) return;
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(apiUrl("/api/assets/upload"), {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        src?: string;
        error?: string;
      };
      if (!res.ok || !data.src) {
        throw new Error(data.error || t("docs.imageFailed"));
      }
      editor.chain().focus().setImage({ src: data.src }).run();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("docs.imageFailed"));
    }
  }

  if (!editor) return null;

  return (
    <div className="doc-editor">
      <div className="doc-format" role="toolbar" aria-label={t("spaces.title")}>
        <FormatBtn
          label={t("docs.bold")}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          B
        </FormatBtn>
        <FormatBtn
          label={t("docs.italic")}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          I
        </FormatBtn>
        <FormatBtn
          label={t("docs.strike")}
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          S
        </FormatBtn>
        <span className="doc-format-sep" />
        <FormatBtn
          label={t("docs.h1")}
          active={editor.isActive("heading", { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          H1
        </FormatBtn>
        <FormatBtn
          label={t("docs.h2")}
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          H2
        </FormatBtn>
        <FormatBtn
          label={t("docs.h3")}
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          H3
        </FormatBtn>
        <span className="doc-format-sep" />
        <FormatBtn
          label={t("docs.bullet")}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          •
        </FormatBtn>
        <FormatBtn
          label={t("docs.ordered")}
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.
        </FormatBtn>
        <span className="doc-format-sep" />
        <FormatBtn
          label={t("docs.link")}
          active={editor.isActive("link")}
          onClick={setLink}
        >
          ↗
        </FormatBtn>
        <FormatBtn
          label={t("docs.image")}
          active={false}
          onClick={() => fileRef.current?.click()}
        >
          ▣
        </FormatBtn>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void onPickImage(file);
          }}
        />
      </div>
      <div className="doc-editor-body">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function FormatBtn({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      className={"doc-format-btn" + (active ? " is-on" : "")}
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
