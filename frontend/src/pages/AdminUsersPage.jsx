import { useEffect, useMemo, useState } from "react";
import TablePagination from "../components/TablePagination.jsx";
import useTablePagination from "../hooks/useTablePagination.js";
import Header from "../components/Header.jsx";
import PageBackButton from "../components/PageBackButton.jsx";
import {
  createUser,
  deactivateUser,
  listUserDeletionRequests,
  listUsers,
  permanentlyDeleteUser,
  requestAdminDeletion,
  resetUserPassword,
  restoreUser,
  reviewAdminDeletion,
  updateUser
} from "../services/adminUsersApi.js";

const emptyAccount = {
  username: "",
  fullName: "",
  role: "user",
  password: ""
};

function formatDate(value) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function AdminUsersPage({ currentUser, onBack, onLogout }) {
  const [users, setUsers] = useState([]);
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [fields, setFields] = useState(emptyAccount);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const [accounts, requests] = await Promise.all([
        listUsers(),
        listUserDeletionRequests()
      ]);
      setUsers(accounts);
      setDeletionRequests(requests);
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((account) => {
      const matchesSearch = !query
        || account.username.toLowerCase().includes(query)
        || account.fullName.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "active" ? account.isActive : !account.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [users, search, statusFilter]);
  const pagination = useTablePagination(filteredUsers, [search, statusFilter]);

  const accountCounts = useMemo(() => ({
    total: users.length,
    admins: users.filter((item) => item.role === "admin" && item.isActive).length,
    active: users.filter((item) => item.isActive).length,
    inactive: users.filter((item) => !item.isActive).length
  }), [users]);

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setFields((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    setMessage({ type: "", text: "" });
  }

  function startCreate() {
    setEditingId(null);
    setFields(emptyAccount);
    setResetTarget(null);
    setMessage({ type: "", text: "" });
  }

  function startEdit(account) {
    setEditingId(account.id);
    setFields({
      username: account.username,
      fullName: account.fullName,
      role: account.role,
      password: ""
    });
    setResetTarget(null);
    setMessage({ type: "", text: "" });
  }

  async function submitAccount(event) {
    event.preventDefault();
    if (fields.username.trim().length < 3 || fields.fullName.trim().length < 2) {
      setMessage({ type: "error", text: "Enter a valid username and employee name." });
      return;
    }
    if (!editingId && fields.password.length < 8) {
      setMessage({ type: "error", text: "The temporary password must have at least 8 characters." });
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateUser(editingId, {
          username: fields.username.trim(),
          fullName: fields.fullName.trim(),
          role: fields.role
        });
        setUsers((current) => current.map((item) => String(item.id) === String(updated.id) ? updated : item));
        setMessage({ type: "success", text: "Account changes saved." });
      } else {
        const created = await createUser({
          username: fields.username.trim(),
          fullName: fields.fullName.trim(),
          role: fields.role,
          password: fields.password
        });
        setUsers((current) => [...current, created]);
        setMessage({ type: "success", text: "New account created." });
        setFields(emptyAccount);
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function submitPasswordReset(event) {
    event.preventDefault();
    if (newPassword.length < 8) {
      setMessage({ type: "error", text: "The new password must have at least 8 characters." });
      return;
    }

    setSaving(true);
    try {
      const result = await resetUserPassword(resetTarget.id, newPassword);
      setMessage({ type: "success", text: result.message || "Password reset successfully." });
      setResetTarget(null);
      setNewPassword("");
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  }

  function askDeletionReason(account, permanent = false) {
    return window.prompt(
      permanent
        ? `Why should ${account.fullName} be permanently deleted?`
        : `Why should ${account.fullName} be deactivated?`,
      "Employment or access ended"
    )?.trim();
  }

  async function handleDeactivate(account) {
    const reason = askDeletionReason(account);
    if (!reason) return;
    setMessage({ type: "", text: "" });

    try {
      if (account.role === "admin" && !currentUser.isPrimaryAdmin) {
        const confirmed = window.confirm(
          `Send a request to the Primary Admin to delete ${account.fullName}'s Admin account?`
        );
        if (!confirmed) return;
        setSaving(true);
        const result = await requestAdminDeletion(account.id, reason);
        setMessage({ type: "success", text: result.message });
      } else {
        const confirmed = window.confirm(
          `Are you sure you want to delete ${account.fullName}'s account? The account will be deactivated and can be restored.`
        );
        if (!confirmed) return;
        setSaving(true);
        const result = await deactivateUser(account.id, reason);
        setMessage({ type: "success", text: result.message });
      }
      await loadUsers();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally { setSaving(false); }
  }

  async function handleRestore(account) {
    if (!window.confirm(`Restore ${account.fullName}'s account and allow login again?`)) return;
    setSaving(true);
    try {
      const result = await restoreUser(account.id);
      setMessage({ type: "success", text: result.message });
      await loadUsers();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally { setSaving(false); }
  }

  async function handlePermanentDelete(account) {
    const reason = askDeletionReason(account, true);
    if (!reason) return;
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${account.fullName}'s account? This cannot be undone. Business and audit records will remain, but their account association will be removed.`
    );
    if (!confirmed) return;
    setSaving(true);
    try {
      const result = await permanentlyDeleteUser(account.id, reason);
      setMessage({ type: "success", text: result.message });
      await loadUsers();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally { setSaving(false); }
  }

  async function handleReview(request, decision) {
    const verb = decision === "approve" ? "approve" : "reject";
    if (!window.confirm(`${verb === "approve" ? "Approve" : "Reject"} the request to delete ${request.targetName}'s Admin account?`)) return;
    setSaving(true);
    try {
      const result = await reviewAdminDeletion(request.id, decision);
      setMessage({ type: "success", text: result.message });
      await loadUsers();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally { setSaving(false); }
  }

  return (
    <div className="app-page admin-users-page">
      <Header user={currentUser} onLogout={onLogout} />

      <main className="admin-users-shell">
        <PageBackButton label="Back to Dashboard" onClick={onBack} />
        <div className="admin-titlebar">
          <div>
            <p>Administrator Access</p>
            <h1>Account Management</h1>
          </div>
          <button className="admin-add-button" type="button" onClick={startCreate}>+ Add Account</button>
        </div>

        <section className="account-stats" aria-label="Account summary">
          <div><span>Total Accounts</span><strong>{accountCounts.total}</strong></div>
          <div><span>Active Admins</span><strong>{accountCounts.admins}</strong></div>
          <div><span>Active Accounts</span><strong>{accountCounts.active}</strong></div>
          <div><span>Inactive</span><strong>{accountCounts.inactive}</strong></div>
        </section>

        <div className="admin-workspace">
          <section className="accounts-panel" aria-labelledby="accountsTitle">
            <div className="accounts-panel__header">
              <div>
                <p className="section-kicker">Authorized personnel</p>
                <h2 id="accountsTitle">Admin and User Accounts</h2>
              </div>
              <div className="account-filters">
                <input
                  type="search"
                  placeholder="Search name or username"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search accounts"
                />
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter account status">
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="account-table-wrap">
              <table className="account-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan="5" className="account-empty">Loading accounts…</td></tr>}
                  {!loading && pagination.pageItems.map((account) => (
                    <tr key={account.id}>
                      <td>
                        <strong>{account.fullName}</strong>
                        <span>@{account.username}{String(account.id) === String(currentUser.id) ? " · You" : ""}</span>
                      </td>
                      <td>
                        <span className={`role-badge role-badge--${account.role}`}>
                          {account.isPrimaryAdmin ? "Primary Admin" : account.role}
                        </span>
                      </td>
                      <td>
                        <span className={`status-dot ${account.isActive ? "is-active" : "is-inactive"}`}>
                          {account.isActive ? "Active" : "Deactivated"}
                        </span>
                      </td>
                      <td>{formatDate(account.lastLoginAt)}</td>
                      <td className="account-actions">
                        {account.isActive ? (
                          <>
                            <button type="button" onClick={() => startEdit(account)}>Edit</button>
                            <button type="button" onClick={() => { setResetTarget(account); setNewPassword(""); setMessage({ type: "", text: "" }); }}>Reset Password</button>
                            {String(account.id) !== String(currentUser.id) && !account.isPrimaryAdmin && (
                              <button className="account-delete-button" type="button" disabled={saving} onClick={() => handleDeactivate(account)}>
                                {account.role === "admin" && !currentUser.isPrimaryAdmin ? "Request Delete" : "Delete"}
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {(account.role === "user" || currentUser.isPrimaryAdmin) && (
                              <button type="button" disabled={saving} onClick={() => handleRestore(account)}>Restore</button>
                            )}
                            {currentUser.isPrimaryAdmin && !account.isPrimaryAdmin && (
                              <button className="account-delete-button" type="button" disabled={saving} onClick={() => handlePermanentDelete(account)}>Permanent Delete</button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!loading && filteredUsers.length === 0 && (
                    <tr><td colSpan="5" className="account-empty">No accounts match the selected filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalRecords={filteredUsers.length} onPageChange={pagination.setCurrentPage} />

            {deletionRequests.length > 0 && (
              <section className="admin-deletion-requests" aria-labelledby="deletionRequestsTitle">
                <div>
                  <p className="section-kicker">Protected Admin actions</p>
                  <h3 id="deletionRequestsTitle">Admin Deletion Requests</h3>
                </div>
                <div className="admin-deletion-request-list">
                  {deletionRequests.map((request) => (
                    <article key={request.id} className={`admin-deletion-request is-${request.status.toLowerCase()}`}>
                      <div>
                        <strong>{request.targetName}</strong>
                        <span>Requested by {request.requesterName} · {formatDate(request.requestedAt)}</span>
                        <small>{request.reason}</small>
                      </div>
                      <div className="admin-deletion-request-actions">
                        <span>{request.status}</span>
                        {currentUser.isPrimaryAdmin && request.status === "Pending" && (
                          <>
                            <button type="button" disabled={saving} onClick={() => handleReview(request, "approve")}>Approve</button>
                            <button className="account-delete-button" type="button" disabled={saving} onClick={() => handleReview(request, "reject")}>Reject</button>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </section>

          <aside className="account-editor" aria-labelledby="accountEditorTitle">
            {resetTarget ? (
              <form onSubmit={submitPasswordReset}>
                <p className="section-kicker">Security</p>
                <h2 id="accountEditorTitle">Reset Password</h2>
                <p className="editor-helper">Set a temporary password for <strong>{resetTarget.fullName}</strong>.</p>
                <label>
                  New password
                  <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength="8" autoComplete="new-password" required />
                </label>
                <div className="editor-actions">
                  <button className="secondary-action" type="button" onClick={() => setResetTarget(null)}>Cancel</button>
                  <button className="primary-action" type="submit" disabled={saving}>Reset Password</button>
                </div>
              </form>
            ) : (
              <form onSubmit={submitAccount}>
                <p className="section-kicker">{editingId ? "Update access" : "New personnel"}</p>
                <h2 id="accountEditorTitle">{editingId ? "Edit Account" : "Create Account"}</h2>
                <label>
                  Employee name
                  <input name="fullName" value={fields.fullName} onChange={updateField} maxLength="120" required />
                </label>
                <label>
                  Username
                  <input name="username" value={fields.username} onChange={updateField} minLength="3" maxLength="50" autoComplete="off" required />
                </label>
                {!editingId && (
                  <label>
                    Temporary password
                    <input name="password" type="password" value={fields.password} onChange={updateField} minLength="8" autoComplete="new-password" required />
                  </label>
                )}
                <label>
                  Account role
                  <select name="role" value={fields.role} onChange={updateField}>
                    <option value="user">User — add, edit, and delete records</option>
                    <option value="admin" disabled={!currentUser.isPrimaryAdmin}>Admin — protected management access</option>
                  </select>
                </label>
                <div className="editor-actions">
                  {editingId && <button className="secondary-action" type="button" onClick={startCreate}>Cancel</button>}
                  <button className="primary-action" type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save Changes" : "Create Account"}</button>
                </div>
              </form>
            )}

            <p className={`admin-message ${message.type}`} role="status">{message.text}</p>
          </aside>
        </div>
      </main>
    </div>
  );
}
