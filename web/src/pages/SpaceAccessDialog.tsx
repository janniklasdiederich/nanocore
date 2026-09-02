import { useCallback } from "react";
import { api, type DocSpace } from "../api";
import { AccessDialog } from "./AccessDialog";

export function SpaceAccessDialog({
  space,
  onClose,
}: {
  space: DocSpace;
  onClose: () => void;
}) {
  const load = useCallback(() => api.getSpaceMembers(space.id), [space.id]);
  const save = useCallback(
    (userIds: string[], groupIds: string[]) =>
      api.setSpaceMembers(space.id, userIds, groupIds),
    [space.id],
  );
  return (
    <AccessDialog name={space.name} onClose={onClose} load={load} save={save} />
  );
}
