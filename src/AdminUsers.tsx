import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from './lib/supabase';

type AdminUser = {
  userId: string;
  username: string;
  email: string | null;
  role: string;
};

type AdminUsersProps = {
  currentUserId: string;
  onUserDeleted: () => void;
};

export function AdminUsers({ currentUserId, onUserDeleted }: AdminUsersProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadUsers() {
      const { data, error } = await supabase.functions.invoke<{ users: AdminUser[] }>('admin-users', { method: 'GET' });
      if (!active) return;

      if (error || !data?.users) {
        setStatus('error');
      } else {
        setUsers(data.users);
        setStatus('ready');
      }
    }

    void loadUsers();
    return () => { active = false; };
  }, []);

  async function deleteUser(user: AdminUser) {
    if (!window.confirm(`Delete ${user.username}? Their account and all their ratings will be permanently removed.`)) return;

    setDeletingId(user.userId);
    setDeleteError('');
    const { error } = await supabase.functions.invoke('admin-users', {
      method: 'DELETE',
      body: { userId: user.userId },
    });
    setDeletingId(null);

    if (error) {
      setDeleteError(`Could not delete ${user.username}. Please try again.`);
      return;
    }

    setUsers((current) => current.filter((item) => item.userId !== user.userId));
    onUserDeleted();
  }

  return (
    <section className="admin-users" aria-labelledby="admin-users-title">
      <div className="admin-users-heading">
        <h2 id="admin-users-title">Users</h2>
        {status === 'ready' && <span>{users.length} accounts</span>}
      </div>
      {status === 'loading' && <p className="list-message">Loading users...</p>}
      {status === 'error' && <p className="list-message">Users could not be loaded.</p>}
      {deleteError && <p className="form-message" role="alert">{deleteError}</p>}
      {status === 'ready' && (
        <ul className="admin-user-list">
          {users.map((user) => (
            <li key={user.userId}>
              <div className="admin-user-info">
                <strong>{user.username}</strong>
                <span>{user.email ?? 'No email'}</span>
              </div>
              <span className="admin-user-role">{user.role}</span>
              {user.userId === currentUserId ? (
                <span className="admin-user-self">You</span>
              ) : (
                <button className="icon-button admin-delete-button" type="button" onClick={() => void deleteUser(user)} disabled={deletingId !== null} aria-label={`Delete ${user.username}`} title={`Delete ${user.username}`}>
                  <Trash2 size={17} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
