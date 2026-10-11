import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Camera,
  Link,
  Edit3,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { AuthenticatorAccount, HashAlgorithm, OtpType } from '../../types';
import { cleanBase32, isValidBase32 } from '../../lib/validation';
import { parseOtpUri } from '../../lib/otp-uri';
import { isGoogleMigrationUri, parseGoogleMigrationUri } from '../../lib/google-migration';
import { decodeQrFromImageFile, decodeQrFromImageData } from '../../lib/qr-code';
import { generateTotp } from '../../lib/totp';
import { checkDuplicate } from '../../lib/import-export';
import { t } from '../../lib/i18n';

interface AddAccountModalProps {
  existingAccounts: AuthenticatorAccount[];
  initialAccount?: AuthenticatorAccount | null;
  onSave: (account: AuthenticatorAccount) => void;
  onBatchImport?: (accounts: AuthenticatorAccount[]) => void;
  onClose: () => void;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  existingAccounts,
  initialAccount,
  onSave,
  onBatchImport,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'qr' | 'uri'>('manual');
  const [issuer, setIssuer] = useState(initialAccount?.issuer || '');
  const [name, setName] = useState(initialAccount?.name || '');
  const [secret, setSecret] = useState(initialAccount?.secret || '');
  const [type, setType] = useState<OtpType>(initialAccount?.type || 'totp');
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>(initialAccount?.algorithm || 'SHA-1');
  const [digits, setDigits] = useState<number>(initialAccount?.digits || 6);
  const [period, setPeriod] = useState<number>(initialAccount?.period || 30);
  const [counter, setCounter] = useState<number>(initialAccount?.counter || 0);
  const [group, setGroup] = useState(initialAccount?.group || '');

  const [showSecret, setShowSecret] = useState(false);
  const [previewCode, setPreviewCode] = useState<string>('');
  const [uriInput, setUriInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    const updatePreview = async () => {
      const cleaned = cleanBase32(secret);
      if (isValidBase32(cleaned)) {
        try {
          const code = await generateTotp(cleaned, { period, digits, algorithm });
          if (active) setPreviewCode(code);
        } catch {
          if (active) setPreviewCode('');
        }
      } else {
        if (active) setPreviewCode('');
      }
    };
    updatePreview();
    return () => {
      active = false;
    };
  }, [secret, period, digits, algorithm]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    try {
      setErrorMsg(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
      requestAnimationFrame(scanCameraFrame);
    } catch {
      setErrorMsg(t('camera_permission_denied'));
      stopCamera();
    }
  };

  const scanCameraFrame = () => {
    if (!mediaStreamRef.current || !videoRef.current) return;
    const video = videoRef.current;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = decodeQrFromImageData(imageData);
        if (code) {
          handleDetectedUri(code);
          stopCamera();
          return;
        }
      }
    }
    if (cameraActive) {
      requestAnimationFrame(scanCameraFrame);
    }
  };

  const handleDetectedUri = (detectedText: string) => {
    try {
      setErrorMsg(null);
      if (isGoogleMigrationUri(detectedText)) {
        const batch = parseGoogleMigrationUri(detectedText);
        if (batch.accounts.length === 1) {
          const acc = batch.accounts[0];
          setIssuer(acc.issuer);
          setName(acc.name);
          setSecret(acc.secret);
          setType(acc.type);
          setAlgorithm(acc.algorithm);
          setDigits(acc.digits);
          setPeriod(acc.period);
          setCounter(acc.counter);
          setActiveTab('manual');
        } else if (batch.accounts.length > 1 && onBatchImport) {
          onBatchImport(batch.accounts);
          onClose();
        }
        return;
      }

      if (detectedText.toLowerCase().startsWith('otpauth://')) {
        const parsed = parseOtpUri(detectedText);
        setIssuer(parsed.issuer);
        setName(parsed.name);
        setSecret(parsed.secret);
        setType(parsed.type);
        setAlgorithm(parsed.algorithm);
        setDigits(parsed.digits);
        setPeriod(parsed.period);
        setCounter(parsed.counter);
        setActiveTab('manual');
        return;
      }

      setErrorMsg(t('qr_decode_failed'));
    } catch (err: any) {
      setErrorMsg(err.message || t('qr_decode_failed'));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setErrorMsg(null);
      const text = await decodeQrFromImageFile(file);
      if (!text) {
        setErrorMsg(t('qr_decode_failed'));
        return;
      }
      handleDetectedUri(text);
    } catch {
      setErrorMsg(t('qr_decode_failed'));
    }
  };

  const handleParseUriInput = () => {
    if (!uriInput.trim()) return;
    handleDetectedUri(uriInput.trim());
  };

  const handleSave = () => {
    setErrorMsg(null);
    const cleanedSecret = cleanBase32(secret);

    if (!issuer.trim()) {
      setErrorMsg(t('error_empty_secret'));
      return;
    }
    if (!cleanedSecret) {
      setErrorMsg(t('error_empty_secret'));
      return;
    }
    if (!isValidBase32(cleanedSecret)) {
      setErrorMsg(t('error_invalid_secret'));
      return;
    }

    const candidateAccount: AuthenticatorAccount = {
      id: initialAccount?.id || crypto.randomUUID(),
      issuer: issuer.trim(),
      name: name.trim() || issuer.trim(),
      secret: cleanedSecret,
      type,
      algorithm,
      digits,
      period,
      counter,
      group: group.trim() || undefined,
      isPinned: initialAccount?.isPinned || false,
      createdAt: initialAccount?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    onSave(candidateAccount);
    onClose();
  };

  const candidateAccount: AuthenticatorAccount = {
    id: initialAccount?.id || 'temp',
    issuer: issuer.trim(),
    name: name.trim() || issuer.trim(),
    secret: cleanBase32(secret),
    type,
    algorithm,
    digits,
    period,
    counter,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const duplicateCheck = checkDuplicate(
    candidateAccount,
    existingAccounts.filter((a) => a.id !== initialAccount?.id)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-2xl app-modal p-4 shadow-2xl flex flex-col gap-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-slate-100">
            {initialAccount ? t('menu_edit') : t('add_account')}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        {!initialAccount && (
          <div className="flex rounded-lg bg-slate-800/80 p-0.5 text-xs">
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'manual'
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Edit3 size={13} />
              <span>{t('tab_manual')}</span>
            </button>
            <button
              onClick={() => setActiveTab('qr')}
              className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'qr'
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera size={13} />
              <span>{t('tab_scan_qr')}</span>
            </button>
            <button
              onClick={() => setActiveTab('uri')}
              className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'uri'
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Link size={13} />
              <span>{t('tab_paste_uri')}</span>
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-2 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-200 flex items-start gap-1.5">
            <AlertCircle size={14} className="shrink-0 text-red-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {activeTab === 'qr' && (
          <div className="flex flex-col gap-3 py-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-800/40 hover:bg-slate-800/70 transition-colors cursor-pointer text-center"
            >
              <Upload size={24} className="text-blue-400 mb-2" />
              <span className="text-xs font-medium text-slate-200">
                {t('upload_qr_image')}
              </span>
            </button>

            <div className="flex flex-col items-center">
              {cameraActive ? (
                <div className="flex flex-col items-center w-full gap-2">
                  <div className="relative w-full aspect-square max-w-[200px] overflow-hidden rounded-xl border border-blue-500/50 bg-black">
                    <video ref={videoRef} className="w-full h-full object-cover" />
                  </div>
                  <button
                    onClick={stopCamera}
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium"
                  >
                    {t('camera_stop')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={startCamera}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors"
                >
                  <Camera size={14} />
                  <span>{t('camera_start')}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'uri' && (
          <div className="flex flex-col gap-2 py-2">
            <label className="text-xs text-slate-300 font-medium">
              {t('uri_input_label')}
            </label>
            <textarea
              rows={3}
              value={uriInput}
              onChange={(e) => setUriInput(e.target.value)}
              placeholder={t('uri_placeholder')}
              className="w-full p-2 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleParseUriInput}
              className="self-end px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors"
            >
              Parse URI
            </button>
          </div>
        )}

        {activeTab === 'manual' && (
          <div className="flex flex-col gap-2.5 text-xs">
            <div>
              <label className="text-slate-300 font-medium mb-1 block">
                {t('account_issuer')} *
              </label>
              <input
                type="text"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="Google, GitHub, AWS..."
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-medium mb-1 block">
                {t('account_name')} *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="alice@example.com"
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-medium">{t('secret_key')} *</label>
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <input
                type={showSecret ? 'text' : 'password'}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="JBSWY3DPEHPK3PXP"
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 font-mono uppercase focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-300 font-medium mb-1 block">
                  {t('otp_type')}
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as OtpType)}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="totp">TOTP (Time-based)</option>
                  <option value="hotp">HOTP (Counter-based)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium mb-1 block">
                  {t('algorithm')}
                </label>
                <select
                  value={algorithm}
                  onChange={(e) => setAlgorithm(e.target.value as HashAlgorithm)}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="SHA-1">SHA-1</option>
                  <option value="SHA-256">SHA-256</option>
                  <option value="SHA-512">SHA-512</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-300 font-medium mb-1 block">
                  {t('digits')}
                </label>
                <select
                  value={digits}
                  onChange={(e) => setDigits(Number(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value={6}>6 digits</option>
                  <option value={8}>8 digits</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium mb-1 block">
                  {type === 'totp' ? t('period') : t('counter')}
                </label>
                {type === 'totp' ? (
                  <input
                    type="number"
                    min={5}
                    max={300}
                    value={period}
                    onChange={(e) => setPeriod(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                ) : (
                  <input
                    type="number"
                    min={0}
                    value={counter}
                    onChange={(e) => setCounter(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-medium mb-1 block">
                {t('group_category')} ({t('optional')})
              </label>
              <input
                type="text"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                placeholder="Work, Personal, Finance..."
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {previewCode && (
              <div className="p-2 rounded-lg bg-slate-800/90 border border-slate-700/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Code Preview:</span>
                <span className="font-mono text-sm font-bold text-blue-400 tracking-wider">
                  {previewCode}
                </span>
              </div>
            )}

            {duplicateCheck.isDuplicate && (
              <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-800 text-[11px] text-amber-200 flex items-center gap-1.5">
                <AlertCircle size={13} className="shrink-0 text-amber-400" />
                <span>
                  {duplicateCheck.duplicateType === 'exact'
                    ? t('duplicate_exact')
                    : t('duplicate_conflict')}
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1"
              >
                <CheckCircle2 size={14} />
                <span>{t('save')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
