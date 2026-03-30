import { Link } from 'react-router-dom';
import type { VideoDto } from '@/types/video';
import { useMemo, useState } from 'react';
import {
  useAssignVideoViewerMutation,
  useDeleteVideoMutation,
  useGetOrgMembersQuery,
  useGetVideoAssigneesQuery,
  useUnassignVideoViewerMutation,
  useUpdateVideoMutation,
} from '@/lib/api/pulseApi';
import { useAppSelector } from '@/store/hooks';

type ToastType = 'success' | 'error' | 'info';
type ActionCallbacks = {
  onToast?: (message: string, type?: ToastType) => void;
  onRenameOptimistic?: (videoId: string, nextName: string) => void;
  onRenameRollback?: (videoId: string) => void;
  onDeleteOptimistic?: (videoId: string) => void;
  onDeleteRollback?: (videoId: string) => void;
};

function RenameModal(props: {
  open: boolean;
  value: string;
  saving: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (!props.open) return null;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h3>Rename Video</h3>
        <input value={props.value} onChange={(e) => props.onChange(e.target.value)} />
        <div className="modal-actions">
          <button className="btn btn-secondary btn-sm" onClick={props.onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary btn-sm" disabled={props.saving} onClick={props.onSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function ViewerActions({ video }: { video: VideoDto }) {
  return (
    <div className="actions">
      <Link className="btn btn-secondary btn-sm" to={`/videos/${video._id}`}>
        View
      </Link>
    </div>
  );
}

export function EditorActions({
  video,
  canEdit,
  onToast,
  onRenameOptimistic,
  onRenameRollback,
}: { video: VideoDto; canEdit: boolean } & ActionCallbacks) {
  const [updateVideo, { isLoading: saving }] = useUpdateVideoMutation();
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(video.metadata.originalFilename ?? '');

  const submitRename = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed) return onToast?.('Video name cannot be empty', 'error');
    onRenameOptimistic?.(video._id, trimmed);
    try {
      await updateVideo({ videoId: video._id, originalFilename: trimmed }).unwrap();
      onToast?.('Video renamed', 'success');
      setRenameOpen(false);
    } catch {
      onRenameRollback?.(video._id);
      onToast?.('Rename failed', 'error');
    }
  };

  return (
    <div className="actions">
      <Link className="btn btn-secondary btn-sm" to={`/videos/${video._id}`}>
        View
      </Link>
      {canEdit ? (
        <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={() => setRenameOpen(true)}>
          {saving ? 'Saving…' : 'Edit'}
        </button>
      ) : null}
      <RenameModal
        open={renameOpen}
        value={renameValue}
        saving={saving}
        onChange={setRenameValue}
        onCancel={() => setRenameOpen(false)}
        onSave={() => void submitRename()}
      />
    </div>
  );
}

export function AdminActions({
  video,
  canEdit,
  onToast,
  onRenameOptimistic,
  onRenameRollback,
  onDeleteOptimistic,
  onDeleteRollback,
}: { video: VideoDto; canEdit: boolean } & ActionCallbacks) {
  const [updateVideo, { isLoading: saving }] = useUpdateVideoMutation();
  const [deleteVideo, { isLoading: deleting }] = useDeleteVideoMutation();
  const [assignViewer, { isLoading: assigning }] = useAssignVideoViewerMutation();
  const [unassignViewer, { isLoading: unassigning }] = useUnassignVideoViewerMutation();
  const orgId = useAppSelector((s) => s.auth.organizationId);
  const { data: members } = useGetOrgMembersQuery({ orgId: orgId ?? '' }, { skip: orgId == null });
  const { data: assignees } = useGetVideoAssigneesQuery({ videoId: video._id });
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(video.metadata.originalFilename ?? '');
  const [selectedViewerId, setSelectedViewerId] = useState('');
  const viewers = useMemo(() => (members ?? []).filter((m) => m.role === 'viewer'), [members]);
  const assignedIds = new Set((assignees ?? []).map((a) => a.userId));
  const assignableViewers = viewers.filter((v) => !assignedIds.has(v.userId));

  const submitRename = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed) return onToast?.('Video name cannot be empty', 'error');
    onRenameOptimistic?.(video._id, trimmed);
    try {
      await updateVideo({ videoId: video._id, originalFilename: trimmed }).unwrap();
      onToast?.('Video renamed', 'success');
      setRenameOpen(false);
    } catch {
      onRenameRollback?.(video._id);
      onToast?.('Rename failed', 'error');
    }
  };

  return (
    <div className="actions">
      <Link className="btn btn-secondary btn-sm" to={`/videos/${video._id}`}>
        View
      </Link>
      {canEdit ? (
        <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={() => setRenameOpen(true)}>
          {saving ? 'Saving…' : 'Edit'}
        </button>
      ) : null}
      <button
        type="button"
        className="danger btn-sm"
        disabled={deleting}
        onClick={() => void (async () => {
          onDeleteOptimistic?.(video._id);
          try {
            await deleteVideo({ videoId: video._id }).unwrap();
            onToast?.('Video deleted', 'success');
          } catch {
            onDeleteRollback?.(video._id);
            onToast?.('Delete failed', 'error');
          }
        })()}
      >
        {deleting ? 'Deleting…' : 'Delete'}
      </button>
      <div className="assign-controls">
        <select value={selectedViewerId} onChange={(e) => setSelectedViewerId(e.target.value)} disabled={assigning}>
          <option value="">Assign to viewer...</option>
          {assignableViewers.map((viewer) => (
            <option key={viewer.userId} value={viewer.userId}>
              {viewer.email}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!selectedViewerId || assigning}
          onClick={() => void (async () => {
            try {
              await assignViewer({ videoId: video._id, userId: selectedViewerId }).unwrap();
              onToast?.('Viewer assigned', 'success');
              setSelectedViewerId('');
            } catch {
              onToast?.('Assign failed', 'error');
            }
          })()}
        >
          {assigning ? 'Assigning…' : 'Assign'}
        </button>
      </div>
      <div className="assignee-chips">
        {(assignees ?? []).map((a) => (
          <span key={a.userId} className="assignee-chip">
            {a.email}
            <button
              type="button"
              className="chip-remove"
              disabled={unassigning}
              onClick={() => void (async () => {
                try {
                  await unassignViewer({ videoId: video._id, userId: a.userId }).unwrap();
                  onToast?.('Viewer unassigned', 'info');
                } catch {
                  onToast?.('Unassign failed', 'error');
                }
              })()}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <RenameModal
        open={renameOpen}
        value={renameValue}
        saving={saving}
        onChange={setRenameValue}
        onCancel={() => setRenameOpen(false)}
        onSave={() => void submitRename()}
      />
    </div>
  );
}

