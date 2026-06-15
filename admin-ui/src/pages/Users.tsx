import React, { useEffect, useState } from 'react';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Alert, Snackbar, Skeleton } from '@mui/material';
import { Shield, User, Zap, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';
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
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.getUsers();
      if (response?.users) {
        setUsers(response.users);
      }
    } catch (err) {
      setToast({
        open: true,
        message: 'Failed to retrieve user accounts.',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleTogglePlan = async (userId: string, currentPlan: 'free' | 'pro') => {
    const nextPlan = currentPlan === 'free' ? 'pro' : 'free';
    try {
      await api.updateUserPlan(userId, nextPlan);
      setToast({
        open: true,
        message: `Plan successfully updated to ${nextPlan.toUpperCase()}`,
        severity: 'success',
      });
      fetchUsers();
    } catch (err) {
      setToast({
        open: true,
        message: 'Failed to update plan.',
        severity: 'error',
      });
    }
  };

  const handleToggleRole = async (userId: string, currentRole: 'user' | 'admin') => {
    const nextRole = currentRole === 'user' ? 'admin' : 'user';
    try {
      await api.updateUserRole(userId, nextRole);
      setToast({
        open: true,
        message: `Role successfully updated to ${nextRole.toUpperCase()}`,
        severity: 'success',
      });
      fetchUsers();
    } catch (err) {
      setToast({
        open: true,
        message: 'Failed to update role.',
        severity: 'error',
      });
    }
  };

  const columns: GridColDef[] = [
    { field: 'username', headerName: 'Username', width: 200, renderCell: (params) => (
      <div className="flex items-center gap-3 font-medium text-slate-800">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          params.row.role === 'admin' ? 'bg-[#EEF2FF] text-indigo-600' : 'bg-slate-100 text-slate-400'
        }`}>
          {params.row.role === 'admin' ? (
            <Shield className="w-4 h-4" />
          ) : (
            <User className="w-4 h-4" />
          )}
        </div>
        <span className="font-semibold">{params.value}</span>
      </div>
    )},
    { field: 'role', headerName: 'Role', width: 120, renderCell: (params) => (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold uppercase ${
        params.value === 'admin' 
          ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
          : 'bg-slate-100 text-slate-500 border border-slate-200'
      }`}>
        {params.value === 'admin' && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
        {params.value}
      </span>
    )},
    { field: 'plan', headerName: 'Plan', width: 120, renderCell: (params) => (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold uppercase ${
        params.value === 'pro' 
          ? 'bg-sky-50 text-sky-600 border border-sky-100' 
          : 'bg-slate-100 text-slate-500 border border-slate-200'
      }`}>
        {params.value === 'pro' && <Sparkles className="w-3.5 h-3.5" />}
        {params.value}
      </span>
    )},
    { field: 'scansToday', headerName: 'Scans Today', width: 130, align: 'center', headerAlign: 'center', renderCell: (params) => (
      <span className="font-mono text-slate-700 font-bold">{params.value}</span>
    )},
    { field: 'createdAt', headerName: 'Created At', width: 180, valueGetter: (value) => new Date(value).toLocaleString() },
    { field: 'lastLogin', headerName: 'Last Login', width: 180, valueGetter: (value) => value ? new Date(value).toLocaleString() : 'Never' },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 280,
      sortable: false,
      renderCell: (params) => (
        <div className="flex items-center gap-2 h-full">
          <button
            onClick={() => handleTogglePlan(params.row.id, params.row.plan)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 border ${
              params.row.plan === 'free' 
                ? 'bg-sky-50 hover:bg-sky-100 text-sky-600 border-sky-200'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
          >
            {params.row.plan === 'free' ? 'Upgrade to Pro' : 'Downgrade to Free'}
          </button>
          <button
            onClick={() => handleToggleRole(params.row.id, params.row.role)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 border ${
              params.row.role === 'user' 
                ? 'bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#4F46E5] border-indigo-200'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
          >
            {params.row.role === 'user' ? 'Grant Admin' : 'Revoke Admin'}
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none bg-[#F8FAFC]">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Identity Directory</h1>
          <p className="text-sm text-slate-500">Manage platform access controls, active roles, and daily compliance parameters.</p>
        </div>
        <button
          onClick={fetchUsers}
          className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 transition-all duration-200 shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span>Synchronize Users</span>
        </button>
      </div>

      <div className="glass-card p-6 min-h-[500px] bg-white">
        {loading ? (
          <div className="space-y-4">
            <Skeleton variant="rectangular" width="100%" height={40} className="bg-slate-100 rounded-lg" />
            <Skeleton variant="rectangular" width="100%" height={300} className="bg-slate-100 rounded-lg" />
          </div>
        ) : (
          <div style={{ height: 450, width: '100%' }}>
            <DataGrid
              rows={users}
              columns={columns}
              initialState={{
                pagination: { paginationModel: { pageSize: 5 } },
              }}
              pageSizeOptions={[5, 10, 20]}
              checkboxSelection={false}
              disableRowSelectionOnClick
              sx={{
                border: 'none',
                color: '#0F172A',
                fontFamily: 'var(--font-body)',
                '& .MuiDataGrid-columnHeaders': {
                  backgroundColor: '#F1F5F9',
                  borderBottom: '1px solid #E5E7EB',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                },
                '& .MuiDataGrid-cell': {
                  borderBottom: '1px solid #E5E7EB',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                },
                '& .MuiDataGrid-row': {
                  transition: 'background-color 150ms ease',
                  '&:hover': {
                    backgroundColor: '#F8FAFC',
                  }
                },
                '& .MuiDataGrid-footerContainer': {
                  borderTop: '1px solid #E5E7EB',
                  color: '#475569',
                },
                '& .MuiTablePagination-root': {
                  color: '#475569',
                },
                '& .MuiTablePagination-selectIcon': {
                  color: '#475569',
                }
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
            backgroundColor: toast.severity === 'success' ? '#DEF7EC' : '#FDE8E8',
            color: toast.severity === 'success' ? '#03543F' : '#9B1C1C',
            border: `1px solid ${toast.severity === 'success' ? '#BCF0DA' : '#FBD5D5'}`,
            borderRadius: '12px',
            '& .MuiAlert-icon': {
              color: toast.severity === 'success' ? '#0E9F6E' : '#F98080'
            }
          }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
