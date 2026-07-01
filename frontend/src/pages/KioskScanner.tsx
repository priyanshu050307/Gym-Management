import React, { useEffect, useState, useRef } from 'react';
import { apiFetch } from '../utils/api.js';
import { Html5Qrcode } from 'html5-qrcode';
import {
  QrCode,
  Camera,
  RotateCcw,
  Sparkles,
  UserCheck,
  UserX,
  Smartphone
} from 'lucide-react';

interface MemberCheckInProfile {
  name: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'EXPIRED';
  expiryDate: string;
  checkInCountToday?: number;
  profilePhoto?: string | null;
  medicalHistory?: string | null;
}

interface SeededMemberSummary {
  id: string;
  status: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export const KioskScanner: React.FC = () => {
  const [members, setMembers] = useState<SeededMemberSummary[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [manualIdInput, setManualIdInput] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);

  // Scan state
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
    profile?: MemberCheckInProfile;
  } | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerId = 'qr-reader-element';

  // Synth sound alerts
  const playAccessGrantedSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
      gain1.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 0.25);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.25);
      
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880.00, audioCtx.currentTime); // A5
        gain2.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 0.35);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start();
        osc2.stop(audioCtx.currentTime + 0.35);
      }, 90);
    } catch (e) {
      console.warn('Audio synthesis bypassed:', e);
    }
  };

  const playAccessDeniedSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, audioCtx.currentTime); // A2 low hum
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.45);
    } catch (e) {
      console.warn('Audio synthesis bypassed:', e);
    }
  };

  // Fetch list of members for the quick demo simulator
  const fetchSeededMembers = async () => {
    try {
      setLoadingMembers(true);
      const data = await apiFetch<{ members: SeededMemberSummary[] }>('/members');
      setMembers(data.members);
    } catch (err: any) {
      console.error('Failed to load members for simulator selector:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    fetchSeededMembers();
  }, []);

  // Trigger checkin action
  const executeCheckIn = async (memberId: string) => {
    setScanError(null);
    try {
      const res = await apiFetch<any>(`/members/${memberId}/checkin`, {
        method: 'POST',
      });
      setScanResult({
        success: true,
        message: res.message,
        profile: {
          name: res.member.name,
          status: res.member.status,
          expiryDate: res.member.expiryDate,
          checkInCountToday: 1, // Visual count
          profilePhoto: res.member.profilePhoto,
          medicalHistory: res.member.medicalHistory,
        },
      });
      playAccessGrantedSound();
    } catch (err: any) {
      playAccessDeniedSound();
      setScanResult({
        success: false,
        message: err.message || 'Access Denied: Unrecognized credentials.',
        profile: err.member
          ? {
              name: err.member.name,
              status: err.member.status,
              expiryDate: err.member.expiryDate,
              profilePhoto: err.member.profilePhoto,
              medicalHistory: err.member.medicalHistory,
            }
          : undefined,
      });
    }
  };

  // Start webcam QR camera scanning
  const startCameraScan = async () => {
    setScanning(true);
    setScanResult(null);
    setScanError(null);

    // Give Vite DOM a millisecond to render container
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode(scannerId);
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (qrCodeMessage) => {
            // Found QR Code!
            stopCameraScan();
            executeCheckIn(qrCodeMessage);
          },
          () => {
            // Keep scan loop running silently
          }
        );
      } catch (err: any) {
        console.error('Camera access error:', err);
        setScanError('Unable to access device camera. Please verify permissions or enter ID manually.');
        setScanning(false);
      }
    }, 100);
  };

  // Stop camera scanning
  const stopCameraScan = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
      } catch (err) {
        console.error('Stop scanner error:', err);
      }
      html5QrCodeRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      stopCameraScan();
    };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIdInput.trim()) return;
    executeCheckIn(manualIdInput.trim());
    setManualIdInput('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
          <QrCode className="h-8 w-8 text-gym-primary" />
          Check-In Kiosk Station
        </h1>
        <p className="text-gym-muted mt-1">
          Scan member badges or enter IDs to authorize entrance doors in real-time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Scanner & Simulator Inputs */}
        <div className="lg:col-span-7 space-y-6">
          {/* Main camera / scan controller card */}
          <div className="glass-card rounded-2xl border border-slate-100 p-6 overflow-hidden relative">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2 text-gym-text">
                <Camera className="h-5 w-5 text-gym-secondary" />
                Live Camera Scanner
              </h3>
              {scanning && (
                <button
                  onClick={stopCameraScan}
                  className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-semibold hover:bg-red-500 hover:text-white transition-all"
                >
                  Stop Camera
                </button>
              )}
            </div>

            {scanning ? (
              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-200 flex items-center justify-center">
                {/* QR reader div */}
                <div id={scannerId} className="w-full h-full object-cover"></div>

                {/* Laser scan animation line overlay */}
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-12">
                  <div className="w-full h-[2px] bg-gym-secondary animate-pulse shadow-[0_0_10px_#8b5cf6]"></div>
                  <div className="text-[10px] text-gym-secondary font-mono tracking-widest text-center mt-2 bg-slate-900/30 py-1 rounded px-3 mx-auto border border-slate-100">
                    SCANNING LIVE BADGE
                  </div>
                </div>
              </div>
            ) : (
              <div className="aspect-video w-full rounded-xl bg-gym-darker/40 border border-slate-100 flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="p-4 rounded-full bg-gym-primary/10 border border-gym-primary/20 text-gym-primary">
                  <QrCode className="h-10 w-10" />
                </div>
                <div>
                  <h4 className="font-semibold text-gym-text">Webcam Scan Terminal</h4>
                  <p className="text-xs text-gym-muted max-w-sm mt-1">
                    Click below to open the camera scanner interface to read member badge QR passcodes.
                  </p>
                </div>
                <button
                  onClick={startCameraScan}
                  className="px-5 py-2.5 bg-gradient-premium text-white font-semibold rounded-xl text-sm shadow-md hover:opacity-95 transition-all flex items-center gap-2"
                >
                  <Camera className="h-4 w-4" />
                  Launch Scanner
                </button>
              </div>
            )}

            {scanError && (
              <p className="text-xs text-red-400 font-semibold mt-3 text-center bg-red-500/15 p-2 rounded-lg border border-red-500/10">
                {scanError}
              </p>
            )}
          </div>

          {/* Fallback Manual search bar input */}
          <div className="glass-card rounded-2xl border border-slate-100 p-6">
            <h3 className="text-base font-bold mb-3 text-gym-text">Manual Entrance Log</h3>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter Member ID (UUID) manually..."
                value={manualIdInput}
                onChange={(e) => setManualIdInput(e.target.value)}
                className="gym-input flex-1"
              />
              <button
                type="submit"
                className="px-6 bg-gym-primary hover:bg-gym-primary/80 text-white font-semibold rounded-xl text-sm transition-all"
              >
                Log Entry
              </button>
            </form>
          </div>

          {/* Quick Demo Simulator Dropdown */}
          <div className="glass-card rounded-2xl border border-slate-100 p-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-base font-bold text-gym-text flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gym-secondary" />
                Check-In Kiosk Simulator
              </h3>
              <button
                onClick={fetchSeededMembers}
                className="text-xs text-gym-muted hover:text-gym-text flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Refresh
              </button>
            </div>
            <p className="text-xs text-gym-muted mb-4">
              Simulate scanning the QR Pass of any member in the system without needing a webcam.
            </p>

            {loadingMembers ? (
              <div className="flex justify-center py-4">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gym-primary border-t-transparent"></div>
              </div>
            ) : members.length === 0 ? (
              <div className="text-center text-xs text-gym-muted py-2">
                No members found. Add members to enable simulation.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="p-3 rounded-xl bg-gym-darker/30 border border-slate-100 flex items-center justify-between gap-3 text-left hover:border-slate-200 transition-all"
                  >
                    <div className="truncate">
                      <div className="text-xs font-semibold text-gym-text truncate">
                        {member.user.firstName} {member.user.lastName}
                      </div>
                      <div className="text-[10px] text-gym-muted truncate">
                        ID: {member.id.substring(0, 8)}...
                      </div>
                    </div>
                    <button
                      onClick={() => executeCheckIn(member.id)}
                      className="px-2.5 py-1.5 bg-gym-primary/10 text-gym-primary hover:bg-gym-primary hover:text-white rounded-lg text-[10px] font-bold transition-all border border-gym-primary/20 shrink-0"
                    >
                      Scan QR
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Live Access Verification Panel */}
        <div className="lg:col-span-5">
          <div className="sticky top-6">
            {!scanResult ? (
              /* Awaiting scan state */
              <div className="glass-card rounded-2xl border border-slate-100 p-12 text-center flex flex-col items-center justify-center min-h-[400px] space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-gym-primary/10 animate-ping"></div>
                  <div className="h-20 w-20 rounded-full border border-slate-200 bg-gym-card/40 flex items-center justify-center text-gym-muted">
                    <Smartphone className="h-10 w-10 animate-pulse" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gym-text">Awaiting Member Badge</h3>
                  <p className="text-xs text-gym-muted max-w-xs mx-auto mt-2">
                    Hold a digital pass in front of the scanner or choose a simulated QR badge scan above to verify entrance.
                  </p>
                </div>
              </div>
            ) : (
              /* Validation Response Card */
              <div
                className={`glass-card rounded-2xl border p-8 min-h-[400px] flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${
                  scanResult.success
                    ? 'border-emerald-500/30 bg-emerald-950/5 shadow-[0_0_25px_rgba(16,185,129,0.08)]'
                    : 'border-red-500/30 bg-red-950/5 shadow-[0_0_25px_rgba(239,68,68,0.08)]'
                }`}
              >
                {/* Glow lights */}
                <div
                  className={`absolute top-0 right-0 w-36 h-36 rounded-full blur-[50px] pointer-events-none opacity-40 ${
                    scanResult.success ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                />

                <div className="space-y-6">
                  {/* Status header indicator */}
                  <div className="flex items-center gap-3">
                    {scanResult.success ? (
                      <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <UserCheck className="h-6 w-6" />
                      </div>
                    ) : (
                      <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                        <UserX className="h-6 w-6" />
                      </div>
                    )}
                    <div>
                      <h4
                        className={`text-lg font-extrabold uppercase tracking-wide ${
                          scanResult.success ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {scanResult.success ? 'Access Granted' : 'Access Denied'}
                      </h4>
                      <p className="text-gym-muted text-xs">
                        {scanResult.success ? 'Entrance gate unlocked' : 'Entrance locked'}
                      </p>
                    </div>
                  </div>

                  {/* Profile Detail Block */}
                  {scanResult.profile ? (
                     <div className="space-y-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-4">
                        <div
                          className={`h-14 w-14 rounded-full overflow-hidden flex items-center justify-center shrink-0 border ${
                            scanResult.success
                              ? 'border-emerald-500/25 bg-slate-900'
                              : 'border-red-500/25 bg-slate-900'
                          }`}
                        >
                          {scanResult.profile.profilePhoto ? (
                            <img src={scanResult.profile.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <div className={`font-bold text-lg ${scanResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                              {scanResult.profile.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')}
                            </div>
                          )}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-gym-text text-base">
                            {scanResult.profile.name}
                          </h3>
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              scanResult.profile.status === 'ACTIVE'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {scanResult.profile.status}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 bg-gym-darker/40 p-4 rounded-xl border border-slate-100 text-xs">
                        <div>
                          <div className="text-[10px] text-gym-muted uppercase font-semibold">
                            Expiration Date
                          </div>
                          <div className="font-mono text-gym-text mt-1">
                            {scanResult.profile.expiryDate === 'No active plan'
                              ? 'N/A'
                              : new Date(scanResult.profile.expiryDate).toLocaleDateString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gym-muted uppercase font-semibold">
                            Entry Count Today
                          </div>
                          <div className="font-mono text-gym-text mt-1">
                            {scanResult.profile.checkInCountToday || 1}
                          </div>
                        </div>
                      </div>

                      {scanResult.profile.medicalHistory && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-start gap-2 animate-pulse">
                          <div className="font-bold shrink-0">⚠️ MEDICAL:</div>
                          <div className="font-semibold leading-relaxed">{scanResult.profile.medicalHistory}</div>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Message prompt */}
                  <div
                    className={`p-4 rounded-xl text-xs leading-relaxed border ${
                      scanResult.success
                        ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-300'
                        : 'bg-red-500/5 border-red-500/10 text-red-300'
                    }`}
                  >
                    {scanResult.message}
                  </div>
                </div>

                {/* Reset button */}
                <button
                  onClick={() => setScanResult(null)}
                  className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-gym-text border border-slate-200 font-semibold rounded-xl text-xs transition-all mt-6"
                >
                  Clear & Ready Next Scan
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
