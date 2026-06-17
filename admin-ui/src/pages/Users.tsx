import React, { useEffect, useState } from 'react';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Alert, Snackbar, Skeleton } from '@mui/material';
import { Shield, User, RefreshCw, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react';
import { api } from '../api/client';

interface UserItem {
  id: string;
  username: string;
  role: 'user' | 'admin';
  plan: 'free' | 'pro';
  scansToday: number;
  lastScanDate: string;
  createdAt: string;
  lastLogin: string | null;
}

export default function Users() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getUsers();
      if (response?.users) {
        setUsers(response.users);
      }
    } catch {
      setError('Failed to load users.');
      setToast({ open: true, message: 'Failed to load users.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleTogglePlan = async (userId: string, currentPlan: 'free' | 'pro') => {
    const nextPlan = currentPlan === 'free' ? 'pro' : 'free';
    try {
      await api.updateUserPlan(userId, nextPlan);
      setToast({ open: true, message: `Plan updated to ${nextPlan.toUpperCase()}`, severity: 'success' });
      fetchUsers();
    } catch {
      setToast({ open: true, message: 'Failed to update plan.', severity: 'error' });
    }
  };

  const handleToggleRole = async (userId: string, currentRole: 'user' | 'admin') => {
    const nextRole = currentRole === 'user' ? 'admin' : 'user';
    try {
      await api.updateUserRole(userId, nextRole);
      setToast({ open: true, message: `Role updated to ${nextRole.toUpperCase()}`, severity: 'success' });
      fetchUsers();
    } catch {
      setToast({ open: true, message: 'Failed to update role.', severity: 'error' });
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'username', headerName: 'Username', width: 200, renderCell: (params) => (
        <div className="flex items-center gap-3 font-medium text-slate-700">
          <div className={`w-8 h-8 rounded-md flex items-center justify-center ${params.row.role === 'admin' ? 'bg-armor-primary-subtle text-armor-primary' : 'bg-slate-100 text-slate-400'}`}>
            {params.row.role === 'admin' ? <Shield className="w-4 h-4" aria-hidden="true" /> : <User className="w-4 h-4" aria-hidden="true" />}
          </div>
          <span className="font-medium">{params.value}</span>
        </div>
      )
    },
    { field: 'role', headerName: 'Role', width: 120, renderCell: (params) => (
      <span className="badge">
        {params.value === 'admin' && <span className="w-1.5 h-1.5 rounded-full bg-armor-primary" />}
        {params.value}
      </span>
    )},
    { field: 'plan', headerName: 'Plan', width: 120, renderCell: (params) => (
      <span className="badge">
        {params.value === 'pro' && <Sparkles className="w-3 h-3" aria-hidden="true" />}
        {params.value}
      </span>
    )},
    { field: 'scansToday', headerName: 'Scans Today', width: 130, align: 'center', headerAlign: 'center', renderCell: (params) => (
      <span className="font-mono text-slate-600 font-medium">{params.value}</span>
    )},
    { field: 'createdAt', headerName: 'Created', width: 180, valueGetter: (_, row) => new Date(row.createdAt).toLocaleString() },
    { field: 'lastLogin', headerName: 'Last Login', width: 180, valueGetter: (_, row) => row.lastLogin ? new Date(row.lastLogin).toLocaleString() : 'Never' },
    {
      field: 'actions', headerName: 'Actions', width: 280, sortable: false,
      renderCell: (params) => (
        <div className="flex items-center gap-2 h-full">
          <button onClick={() => handleTogglePlan(params.row.id, params.row.plan)}
            className={`btn px-3 py-1.5 text-xs ${params.row.plan === 'free' ? 'btn-primary' : 'btn-secondary'}`}>
            {params.row.plan === 'free' ? 'Upgrade to Pro' : 'Downgrade to Free'}
          </button>
          <button onClick={() => handleToggleRole(params.row.id, params.row.role)}
            className={`btn px-3 py-1.5 text-xs ${params.row.role === 'user' ? 'btn-primary' : 'btn-secondary'}`}>
            {params.row.role === 'user' ? 'Grant Admin' : 'Revoke Admin'}
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500 mt-1">Manage user accounts, roles, and plans.</p>
        </div>
        <button onClick={fetchUsers} className="btn btn-secondary">
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="card p-6 min-h-[500px]">
        {loading ? (
          <div className="space-y-4">
            <Skeleton variant="rectangular" width="100%" height={40} sx={{ bgcolor: '#F1F5F9', borderRadius: '6px' }} />
            <Skeleton variant="rectangular" width="100%" height={300} sx={{ bgcolor: '#F1F5F9', borderRadius: '6px' }} />
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-armor-critical" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-700 mb-3">{error}</p>
            <button onClick={fetchUsers} className="btn btn-primary btn-sm">Retry</button>
          </div>
        ) : (
          <div style={{ height: 450, width: '100%' }}>
            <DataGrid
              rows={users}
              columns={columns}
              initialState={{ pagination: { paginationModel: { pageSize: 5 } } }}
              pageSizeOptions={[5, 10, 20]}
              checkboxSelection={false}
              disableRowSelectionOnClick
              sx={{
                border: 'none',
                color: 'var(--neutral-700)',
                fontFamily: 'var(--font-ui)',
                '& .MuiDataGrid-columnHeaders': {
                  backgroundColor: 'var(--neutral-100)',
                  borderBottom: '1px solid var(--neutral-200)',
                  color: 'var(--neutral-500)',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                },
                '& .MuiDataGrid-columnHeader:focus': { outline: 'none' },
                '& .MuiDataGrid-cell': {
                  borderBottom: '1px solid var(--neutral-200)',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  outline: 'none',
                },
                '& .MuiDataGrid-row:hover': { backgroundColor: 'var(--neutral-50)' },
                '& .MuiDataGrid-footerContainer': {
                  borderTop: '1px solid var(--neutral-200)',
                  color: 'var(--neutral-500)',
                },
                '& .MuiTablePagination-root': { color: 'var(--neutral-500)' },
                '& .MuiTablePagination-selectIcon': { color: 'var(--neutral-500)' },
              }}
            />
          </div>
        )}
      </div>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setToast({ ...toast, open: false })}
          severity={toast.severity}
          icon={toast.severity === 'success' ? <CheckCircle2 className="w-5 h-5" /> : undefined}
          sx={{
            width: '100%',
            backgroundColor: toast.severity === 'success' ? '#ECFDF5' : '#FEF2F2',
            color: toast.severity === 'success' ? '#065F46' : '#991B1B',
            border: `1px solid ${toast.severity === 'success' ? '#A7F3D0' : '#FECACA'}`,
            borderRadius: '8px',
            '& .MuiAlert-icon': { color: toast.severity === 'success' ? '#059669' : '#DC2626' }
          }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
