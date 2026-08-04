import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

// MUI Core imports
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TablePagination,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  IconButton,
  TextField,
  InputAdornment,
  Toolbar,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  useMediaQuery,
  useTheme,
  Chip,
  Snackbar,
  Avatar,
  Badge,
  Button,
  Divider,
  LinearProgress,
  Tooltip  // Added missing Tooltip import
} from '@mui/material';

// MUI Icons imports
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import EmailIcon from '@mui/icons-material/Email';
import ScheduleIcon from '@mui/icons-material/Schedule';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import PeopleIcon from '@mui/icons-material/People';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';

// UploadActions Component (built inline to avoid import error)
const UploadActions = ({ invId, uploadingId, handleUpload, uploads, disabled }) => {
  const theme = useTheme();
  const fileInputRef = useRef(null);
  const isUploading = uploadingId === `${invId}-builtyPdf`;

  const triggerFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <Box>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleUpload(invId, 'builtyPdf')}
        disabled={isUploading || disabled}
      />
      
      {isUploading ? (
        <CircularProgress size={24} />
      ) : (
        <Tooltip title={disabled ? "No email available for this party" : "Upload Builty"}>
          <span>
            <IconButton
              onClick={triggerFileUpload}
              disabled={disabled}
              size="small"
              sx={{
                color: theme.palette.primary.main,
                '&:hover': {
                  backgroundColor: theme.palette.primary.light + '22'
                }
              }}
            >
              <CloudUploadIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      )}
    </Box>
  );
};

const UploadBuilty = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // State declarations
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingId, setUploadingId] = useState(null);
  const [dateFilter, setDateFilter] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [progress, setProgress] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInvoice, setDialogInvoice] = useState(null);
  const [page, setPage] = useState(0);
  const [pendingDialogOpen, setPendingDialogOpen] = useState(false);
  const [totalDialogOpen, setTotalDialogOpen] = useState(false);
  const [completedDialogOpen, setCompletedDialogOpen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [gatepassDates, setGatepassDates] = useState({});
  
  const navigate = useNavigate();

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = e => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };
  
  const fileInputRef = useRef({});

  // Fetch invoices
  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/invoices/exclude-builty?limit=100&skip=0`);

      if (!res.ok) throw new Error('Failed to load invoices');
      const data = await res.json();
      setInvoices(data);
      setError('');
      setSuccessMessage(`Loaded ${data.length} invoices`);
      setSnackbarOpen(true);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error fetching invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();

    (async function fetchGP() {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/gatepasses`);
        const list = await res.json();

        const invoiceGatepassDates = {};
        list.forEach(gp => {
          gp.draftIds.forEach((idStr, idx) => {
            const invoiceId = Number(idStr);
            const partyDateRaw = gp.parties?.[idx]?.date ?? gp.date ?? gp.createdAt;
            const gpDateISO = new Date(partyDateRaw).toISOString();

            if (
              !invoiceGatepassDates[invoiceId] ||
              new Date(invoiceGatepassDates[invoiceId]) < new Date(gpDateISO)
            ) {
              invoiceGatepassDates[invoiceId] = gpDateISO;
            }
          });
        });

        setGatepassDates(invoiceGatepassDates);
      } catch (err) {
        console.error('Error loading gatepass dates:', err);
      }
    })();
  }, []);

  const isValidParty = (party) => {
    const name = party?.trim()?.toLowerCase();
    return name && name !== 'unknown' && name !== 'undefined';
  };

  const validInvoices = invoices.filter(inv => isValidParty(inv.formData?.partyName));

  // Derive unique dates & parties for the selects
  const uniqueDates = Array.from(new Set(
    invoices
      .map(inv =>
        inv.submittedAt
          ? format(new Date(inv.submittedAt), 'dd MMM yyyy')
          : null
      )
      .filter(Boolean)
  )).sort((a, b) => new Date(b) - new Date(a));

  const uniqueParties = Array.from(new Set(
    validInvoices.map(inv => inv.formData?.partyName?.trim())
  )).sort();

  const partyCount = uniqueParties.length;

  const handleUpload = (invId, field) => async (e = {}) => {
    if (field === 'builtyNotAvailable') {
      try {
        setUploadingId(`${invId}-${field}`);
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/invoices/${invId}/builty-unavailable`, {
          method: 'POST',
        });

        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Failed to mark as unavailable');

        setInvoices(list =>
          list.map(inv =>
            inv.id === invId
              ? {
                  ...inv,
                  builtyStatus: 'not_available',
                  builtyMarkedAt: new Date().toISOString(),
                }
              : inv
          )
        );

        setSuccessMessage(`Marked as Builty Not Available for invoice #${invId}`);
        setSnackbarOpen(true);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setUploadingId(null);
        setProgress(0);
      }
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingId(`${invId}-${field}`);
    setProgress(0);

    const form = new FormData();
    form.append(field, file);

    try {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setProgress(percentComplete);
        }
      });

      const res = await new Promise((resolve, reject) => {
        xhr.open('POST', `${import.meta.env.VITE_API_BASE_URL}/api/invoices/${invId}/upload`);
        xhr.onload = () => resolve(xhr);
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send(form);
      });

      const body = JSON.parse(res.response);
      if (res.status !== 200) throw new Error(body.error || 'Upload failed');

      setInvoices(list =>
        list.map(inv =>
          inv.id === invId
            ? {
                ...inv,
                uploads: body.uploads,
                emailSent: body.emailSent,
                emailSentAt: body.emailSentAt
              }
            : inv
        )
      );
      setSuccessMessage(`Document uploaded for invoice #${invId}`);
      setSnackbarOpen(true);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setUploadingId(null);
      setProgress(0);
    }
  };

  const handleDialogUpload = (field) => async (e) => {
    await handleUpload(dialogInvoice, field)(e);
    handleDialogClose();
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setDialogInvoice(null);
  };

  const filtered = validInvoices
    .filter(inv => {
      const p = inv.formData?.partyName?.trim();
      return p && p.toLowerCase() !== 'unknown';
    })
    .filter(inv => inv.id.toString().includes(searchTerm))
    .filter(inv => {
      if (!dateFilter) return true;
      const d = inv.submittedAt
        ? format(new Date(inv.submittedAt), 'dd MMM yyyy')
        : '';
      return d === dateFilter;
    })
    .filter(inv => {
      if (!partyFilter) return true;
      return inv.formData?.partyName === partyFilter;
    })
    .filter(inv => {
      if (!statusFilter) return true;
      const hasUpload = (inv.uploads?.length || 0) > 0;
      return statusFilter === 'uploaded' ? hasUpload : !hasUpload;
    });

  const pendingCount = validInvoices.filter(inv => (inv.uploads?.length || 0) === 0).length;
  const completedCount = validInvoices.filter(inv => (inv.uploads?.length || 0) > 0).length;

  if (loading) return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
      <CircularProgress size={60} thickness={4} sx={{ color: theme.palette.primary.main }} />
    </Box>
  );

  if (error) return (
    <Box p={3}>
      <Alert severity="error" variant="filled" sx={{ borderRadius: 2 }}>
        {error}
        <Button color="inherit" size="small" onClick={fetchInvoices} sx={{ ml: 2 }}>
          <RefreshIcon fontSize="small" sx={{ mr: 1 }} /> Retry
        </Button>
      </Alert>
    </Box>
  );

  return (
    <Box sx={{ 
      p: isMobile ? 1 : 3, 
      backgroundColor: 'white',
      minHeight: '100vh',
      maxWidth: '2100px',
      justifyContent: 'center',
    }}>
      {/* Header Section */}
      <Paper
        elevation={3}
        sx={{
          mb: 4,
          p: isMobile ? 2 : 3,
          borderRadius: 3,
          background: `linear-gradient(90deg, ${theme.palette.primary.light}22 0%, ${theme.palette.primary.light}11 100%)`,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <PictureAsPdfIcon
              sx={{
                color: theme.palette.primary.main,
                fontSize: isMobile ? '2rem' : '2.5rem',
              }}
            />
            <Typography
              variant={isMobile ? 'h5' : 'h4'}
              sx={{
                fontWeight: 700,
                color: theme.palette.primary.dark,
                lineHeight: 1.2,
              }}
            >
              Builty & Documents
            </Typography>
          </Stack>

          <Typography
            variant="subtitle1"
            sx={{
              mt: 0.5,
              color: theme.palette.text.secondary,
              fontSize: isMobile ? '0.85rem' : '1rem',
            }}
          >
            Manage and upload transport documents for your invoices
          </Typography>
        </Box>

        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          sx={{ mt: isMobile ? 2 : 0 }}
        >
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            sx={{
              borderRadius: '20px',
              px: 3,
              py: 1,
              textTransform: 'none',
              color: theme.palette.secondary.main,
              borderColor: theme.palette.secondary.main,
              '&:hover': {
                backgroundColor: theme.palette.secondary.light,
                borderColor: theme.palette.secondary.dark,
              },
            }}
          >
            Back
          </Button>

          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={fetchInvoices}
            sx={{
              borderRadius: '20px',
              px: 3,
              py: 1,
              textTransform: 'none',
              backgroundColor: theme.palette.primary.main,
              '&:hover': {
                backgroundColor: theme.palette.primary.dark,
                boxShadow: `0 4px 12px ${theme.palette.primary.light}`,
              },
            }}
          >
            Refresh Data
          </Button>
        </Stack>
      </Paper>

      {/* Stats Summary */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 3,
        mb: 4
      }}>
        {/* Total Parties Card */}
        <Paper sx={{
          p: 2.5,
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #f6f9fc 0%, #ffffff 100%)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          borderLeft: `4px solid ${theme.palette.info.main}`,
          transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
          },
          position: 'relative',
          overflow: 'hidden',
        }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar sx={{
              bgcolor: 'transparent',
              width: 56,
              height: 56,
              border: `2px dashed ${theme.palette.info.light}`,
              boxShadow: `0 0 0 4px ${theme.palette.info.light}33`
            }}>
              <PeopleIcon sx={{ 
                color: theme.palette.info.main,
                fontSize: '28px'
              }} />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                TOTAL PARTIES
              </Typography>
              <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5 }}>
                {partyCount}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                <span>Unique Count of Parties</span>
              </Typography>
            </Box>
          </Stack>
        </Paper>

        {/* Total Invoices Card */}
        <Paper sx={{
          p: 2.5,
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #fef6f6 0%, #ffffff 100%)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          borderLeft: `4px solid ${theme.palette.primary.main}`,
          transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
          }
        }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar sx={{
              bgcolor: 'transparent',
              width: 56,
              height: 56,
              border: `2px dashed ${theme.palette.primary.light}`,
              boxShadow: `0 0 0 4px ${theme.palette.primary.light}33`
            }}>
              <InsertDriveFileIcon sx={{ 
                color: theme.palette.primary.main,
                fontSize: '28px'
              }} />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                TOTAL INVOICES
              </Typography>
              <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5 }}>
                {validInvoices.length}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                <span>Total Invoices Included Pending and Submitted Builties</span>
              </Typography>
            </Box>
          </Stack>
        </Paper>

        {/* Pending Builty Card */}
        <Paper sx={{
          p: 2.5,
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #fff9f6 0%, #ffffff 100%)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          borderLeft: `4px solid ${theme.palette.warning.main}`,
          transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
          },
          cursor: 'pointer'
        }}
        onClick={() => setPendingDialogOpen(true)}
        >
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar sx={{
              bgcolor: 'transparent',
              width: 56,
              height: 56,
              border: `2px dashed ${theme.palette.warning.light}`,
              boxShadow: `0 0 0 4px ${theme.palette.warning.light}33`
            }}>
              <CloudOffIcon sx={{ 
                color: theme.palette.warning.main,
                fontSize: '28px'
              }} />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                PENDING BUILTY
              </Typography>
              <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5 }}>
                {pendingCount}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                <span>Requires attention</span>
              </Typography>
            </Box>
          </Stack>
        </Paper>
      </Box>

      {/* Filters Section */}
      <Paper sx={{ 
        mb: 3, 
        p: 3, 
        borderRadius: 3,
        backgroundColor: 'white',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        transition: 'box-shadow 0.3s ease',
        '&:hover': {
          boxShadow: '0 6px 16px rgba(0,0,0,0.1)'
        }
      }}>
        <Typography variant="h6" sx={{ 
          mb: 2, 
          color: theme.palette.text.primary,
          display: 'flex',
          alignItems: 'center'
        }}>
          <FilterAltIcon sx={{ 
            mr: 1, 
            color: theme.palette.primary.main,
            fontSize: '1.5rem'
          }} />
          Filter Invoices
        </Typography>
        <Divider sx={{ mb: 3 }} />
        
        <Stack 
          direction={isMobile ? 'column' : 'row'} 
          spacing={3} 
          alignItems={isMobile ? 'stretch' : 'center'}
          sx={{
            '& > *': {
              flex: isMobile ? '1 1 100%' : '1 1 auto'
            }
          }}
        >
          <FormControl fullWidth size="small" sx={{ 
            borderRadius: 2, 
            backgroundColor: '#f5f7fa',
            '&:hover': { backgroundColor: '#ebeff5' }
          }}>
            <InputLabel sx={{ 
              color: theme.palette.text.secondary,
              '&.Mui-focused': { color: theme.palette.primary.main }
            }}>
              Party
            </InputLabel>
            <Select
              value={partyFilter}
              label="Party"
              onChange={e => setPartyFilter(e.target.value)}
            >
              <MenuItem value=""><em>All Parties</em></MenuItem>
              {uniqueParties.map(p => (
                <MenuItem key={p} value={p}>{p}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            placeholder="Search Invoice ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            sx={{
              minWidth: isMobile ? '100%' : 180,
              borderRadius: 2,
              backgroundColor: '#f5f7fa',
              '&:hover': { backgroundColor: '#ebeff5' }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="primary" />
                </InputAdornment>
              )
            }}
            variant="outlined"
          />

          <FormControl size="small" sx={{ minWidth: isMobile ? '100%' : 180, borderRadius: 2, backgroundColor: '#f5f7fa', '&:hover': { backgroundColor: '#ebeff5' } }}>
            <InputLabel sx={{ color: theme.palette.text.secondary, '&.Mui-focused': { color: theme.palette.primary.main } }}>
              Date
            </InputLabel>
            <Select
              value={dateFilter}
              label="Date"
              onChange={e => setDateFilter(e.target.value)}
            >
              <MenuItem value=""><em>All Dates</em></MenuItem>
              {uniqueDates.map(d => (
                <MenuItem key={d} value={d}>{d}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: isMobile ? '100%' : 180, borderRadius: 2, backgroundColor: '#f5f7fa', '&:hover': { backgroundColor: '#ebeff5' } }}>
            <InputLabel sx={{ color: theme.palette.text.secondary, '&.Mui-focused': { color: theme.palette.primary.main } }}>
              Status
            </InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={e => setStatusFilter(e.target.value)}
            >
              <MenuItem value=""><em>All Status</em></MenuItem>
              <MenuItem value="pending">
                <Box display="flex" alignItems="center">
                  <CloudOffIcon fontSize="small" sx={{ mr: 1, color: theme.palette.warning.main }} />
                  Pending
                </Box>
              </MenuItem>
              <MenuItem value="uploaded">
                <Box display="flex" alignItems="center">
                  <CloudDoneIcon fontSize="small" sx={{ mr: 1, color: theme.palette.success.main }} />
                  Uploaded
                </Box>
              </MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Main Table */}
      <Paper sx={{ 
        borderRadius: '16px',
        backgroundColor: 'white',
        boxShadow: '0 8px 32px rgba(0,0,0,0.05)',
        overflow: 'hidden',
        mb: 4,
        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
        border: '1px solid rgba(0,0,0,0.05)',
        '&:hover': {
          boxShadow: '0 12px 48px rgba(0,0,0,0.1)',
          borderColor: 'rgba(0,0,0,0.1)'
        }
      }}>
        {/* Upload Progress Bar */}
        {uploadingId && (
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            color="primary"
            sx={{ 
              height: 4,
              background: `${theme.palette.primary.light}33`,
              '& .MuiLinearProgress-bar': {
                borderRadius: '0 4px 4px 0',
                transition: 'transform 0.2s ease-out',
                background: `linear-gradient(90deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`
              }
            }}
          />
        )}
        
        <TableContainer>
          <Table size={isMobile ? 'small' : 'medium'}>
            <TableHead sx={{ 
              background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
              '& th': { 
                color: 'white', 
                fontWeight: 600,
                fontSize: isMobile ? '0.75rem' : '0.875rem',
                letterSpacing: '0.5px',
                borderBottom: 'none',
                padding: isMobile ? '12px 8px' : '16px',
              }
            }}>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Invoice ID</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Party</TableCell>
                <TableCell align="center">Email Status</TableCell>
                <TableCell align="center">Overdue Days</TableCell>
                <TableCell align="center">Documents</TableCell>
                <TableCell align="center">View</TableCell>
              </TableRow>
            </TableHead>
            
            <TableBody>
              {filtered.length > 0 ? (
                filtered
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((inv, idx) => {
                    const gpDateISO = gatepassDates[inv.id];
                    const msPerDay = 1000 * 60 * 60 * 24;
                    const overdueDays =
                      gpDateISO && (!inv.uploads || inv.uploads.length === 0)
                        ? Math.max(0, Math.floor((Date.now() - new Date(gpDateISO)) / msPerDay))
                        : null;

                    return (
                      <TableRow
                        key={inv.id}
                        hover
                        sx={{
                          '&:nth-of-type(even)': { 
                            backgroundColor: '#fafbff' 
                          },
                          '&:last-child td': { 
                            borderBottom: 0 
                          },
                          '&:hover': { 
                            backgroundColor: '#f5f8ff',
                          }
                        }}
                      >
                        <TableCell sx={{ 
                          color: theme.palette.text.secondary,
                          fontWeight: 500
                        }}>
                          {page * rowsPerPage + idx + 1}
                        </TableCell>

                        <TableCell sx={{ 
                          fontWeight: 600,
                          color: theme.palette.primary.dark
                        }}>
                          <Badge
                            color="error"
                            variant="dot"
                            invisible={!inv.isNew}
                            anchorOrigin={{
                              vertical: 'top',
                              horizontal: 'left'
                            }}
                          >
                            <Box component="span" sx={{ 
                              backgroundColor: `${theme.palette.primary.light}33`,
                              borderRadius: '4px',
                              px: 1,
                              py: 0.5,
                              display: 'inline-block'
                            }}>
                              #{inv.id}
                            </Box>
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {inv.submittedAt ? format(new Date(inv.submittedAt), 'dd MMM yyyy') : '-'}
                          </Typography>
                          {gpDateISO && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              GP: {format(new Date(gpDateISO), 'dd MMM')}
                            </Typography>
                          )}
                        </TableCell>

                        <TableCell sx={{
                          maxWidth: 150,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontWeight: 500
                        }}>
                          {inv.formData?.partyName}
                        </TableCell>

                        <TableCell align="center">
                          {inv.emailSent ? (
                            <Chip
                              icon={<CheckCircleIcon fontSize="small" />}
                              label="Sent"
                              size="small"
                              color="success"
                              sx={{
                                backgroundColor: `${theme.palette.success.light}33`,
                                color: theme.palette.success.dark,
                                fontWeight: 500,
                              }}
                            />
                          ) : (
                            <Chip
                              icon={<ScheduleIcon fontSize="small" />}
                              label="Pending"
                              size="small"
                              color="warning"
                              sx={{
                                backgroundColor: `${theme.palette.warning.light}33`,
                                color: theme.palette.warning.dark,
                                fontWeight: 500,
                              }}
                            />
                          )}
                        </TableCell>

                        <TableCell align="center">
                          {overdueDays != null ? (
                            <Box sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              backgroundColor: overdueDays > 7 ? `${theme.palette.error.light}33` : `${theme.palette.warning.light}33`,
                              color: overdueDays > 7 ? theme.palette.error.dark : theme.palette.warning.dark,
                              borderRadius: '12px',
                              px: 1.5,
                              py: 0.5,
                              fontWeight: 500
                            }}>
                              <ErrorOutlineIcon sx={{ 
                                fontSize: '16px', 
                                mr: 0.5,
                                color: overdueDays > 7 ? theme.palette.error.main : theme.palette.warning.main 
                              }} />
                              {Math.floor(overdueDays)} day{overdueDays !== 1 ? 's' : ''}
                            </Box>
                          ) : (
                            <Typography variant="body2" color="textSecondary">
                              —
                            </Typography>
                          )}
                        </TableCell>

                        <TableCell align="center">
                          <UploadActions
                            invId={inv.id}
                            uploadingId={uploadingId}
                            handleUpload={handleUpload}
                            uploads={inv.uploads}
                            disabled={!inv.partyEmail}
                          />
                        </TableCell>
                        
                        <TableCell align="center">
                          {inv.uploads?.length > 0 ? (() => {
                            const upl = inv.uploads.find(u => u.field === 'builtyPdf') || inv.uploads[0];
                            return (
                              <IconButton
                                size="small"
                                onClick={() => window.open(upl.webViewLink, '_blank')}
                                sx={{
                                  backgroundColor: `${theme.palette.primary.light}33`,
                                  color: theme.palette.primary.main,
                                  '&:hover': {
                                    backgroundColor: `${theme.palette.primary.light}4d`
                                  }
                                }}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            );
                          })() : (
                            <Typography variant="body2" color="textSecondary">
                              —
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <Box sx={{ 
                      textAlign: 'center',
                      maxWidth: 400,
                      margin: '0 auto'
                    }}>
                      <img
                        src="https://cdn-icons-png.flaticon.com/512/4076/4076478.png"
                        alt="No data"
                        style={{ 
                          width: 150, 
                          opacity: 0.7, 
                          marginBottom: 16,
                          filter: 'grayscale(50%)'
                        }}
                      />
                      <Typography variant="h6" color="textSecondary" sx={{ 
                        mt: 2,
                        fontWeight: 500,
                        color: theme.palette.text.secondary
                      }}>
                        No matching invoices found
                      </Typography>
                      <Typography variant="body2" color="textSecondary" sx={{ 
                        mb: 3,
                        color: theme.palette.text.secondary
                      }}>
                        Adjust your filters or search for different criteria
                      </Typography>
                      <Button
                        variant="outlined"
                        color="primary"
                        onClick={() => {
                          setDateFilter('');
                          setPartyFilter('');
                          setStatusFilter('');
                          setSearchTerm('');
                        }}
                        sx={{ 
                          borderRadius: '8px',
                          px: 3, 
                          py: 1,
                          textTransform: 'none',
                          fontWeight: 500,
                          borderWidth: '1.5px',
                        }}
                        startIcon={<FilterAltOffIcon fontSize="small" />}
                      >
                        Reset all filters
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25, 50]}
          sx={{
            borderTop: '1px solid rgba(0,0,0,0.08)',
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
              fontSize: '0.875rem',
              color: theme.palette.text.secondary
            },
            '& .MuiSelect-select': {
              fontWeight: 500
            },
            '& .MuiIconButton-root': {
              color: theme.palette.primary.main,
              '&:disabled': {
                color: theme.palette.text.disabled
              }
            }
          }}
        />
      </Paper>

      {/* Success Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="success"
          variant="filled"
          sx={{
            width: { xs: 'calc(100vw - 32px)', sm: 380 },
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}
          action={
            <IconButton
              size="small"
              aria-label="close"
              color="inherit"
              onClick={() => setSnackbarOpen(false)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {successMessage}
            </Typography>
            <Typography variant="body2">
              Document uploaded successfully!
            </Typography>
          </Box>
        </Alert>
      </Snackbar>

      {/* Pending Dialog */}
      <Dialog
        open={pendingDialogOpen}
        onClose={() => setPendingDialogOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            boxShadow: 4
          }
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            px: 3,
            py: 1.5
          }}
        >
          <Typography variant="h6">Pending Invoices</Typography>
          <IconButton onClick={() => setPendingDialogOpen(false)} sx={{ color: 'primary.contrastText' }}>
            <CloseIcon />
          </IconButton>
        </Box>

        <DialogContent sx={{ backgroundColor: '#f5f6fa', p: 0 }}>
          <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 0 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: 'grey.100' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Serial #</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Invoice Date</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Gatepass Date</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Party</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Overdue Days</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {validInvoices
                  .filter(inv => (inv.uploads?.length || 0) === 0)
                  .map((inv, i) => {
                    const gpDateISO = gatepassDates[inv.id]
                    const msPerDay = 1000 * 60 * 60 * 24
                    const overdueDays = gpDateISO
                      ? Math.max(
                          0,
                          Math.floor((Date.now() - new Date(gpDateISO)) / msPerDay)
                        )
                      : null

                    return (
                      <TableRow
                        key={inv.id}
                        sx={{
                          '&:nth-of-type(even)': { backgroundColor: 'grey.50' },
                          '&:hover': { backgroundColor: 'grey.200' }
                        }}
                      >
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>
                          {inv.submittedAt
                            ? format(new Date(inv.submittedAt), 'dd MMM yyyy')
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {gpDateISO
                            ? format(new Date(gpDateISO), 'dd MMM yyyy')
                            : '—'}
                        </TableCell>
                        <TableCell>{inv.formData?.partyName || '—'}</TableCell>
                        <TableCell>
                          {overdueDays != null
                            ? `${overdueDays} day${overdueDays !== 1 ? 's' : ''}`
                            : '—'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default UploadBuilty;