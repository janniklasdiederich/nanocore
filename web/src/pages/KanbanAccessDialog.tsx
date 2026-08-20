import { useCallback } from "react";
import { api, type Board } from "../api";
import { AccessDialog } from "./AccessDialog";

export function KanbanAccessDialog({
  board,
  onClose,
}: {
  board: Board;
  onClose: () => void;
}) {
  const load = useCallback(() => api.getKanbanMembers(board.id), [board.id]);
  const save = useCallback(
    (userIds: string[], groupIds: string[]) =>
      api.setKanbanMembers(board.id, userIds, groupIds),
    [board.id],
  );
  return (
    <AccessDialog name={board.name} onClose={onClose} load={load} save={save} />
  );
}
