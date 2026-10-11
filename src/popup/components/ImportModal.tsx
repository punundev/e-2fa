import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  CheckSquare,
  Square,
  AlertTriangle,
  Lock,
  Download,
  AlertCircle,
} from 'lucide-react';
import { AuthenticatorAccount } from '../../types';
import { parseImportString, checkDuplicate } from '../../lib/import-export';
import { decodeQrFromImageFile } from '../../lib/qr-code';
import { t } from '../../lib/i18n';

interface ImportModalProps {
  existingAccounts: AuthenticatorAccount[];
  onImportComplete: (accounts: AuthenticatorAccount[]) => void;
  onClose: () => void;
  preloadedAccounts?: AuthenticatorAccount[];
}

export const ImportModal: React.FC<ImportModalProps> = ({
  existingAccounts,
  onImportComplete,
  onClose,
  preloadedAccounts,
}) => {
  const [candidates, setCandidates] = useState<AuthenticatorAccount[]>(
    preloadedAccounts || []
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set((preloadedAccounts || []).map((a) => a.id))
  );
  const [inputRaw, setInputRaw] = useState('');
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [backupPassword, setBackupPassword] = useState('');
  const [rawJsonPayload, setRawJsonPayload] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);

    const isImage = file.type.startsWith('image/');
    if (isImage) {
      try {
        const decodedQr = await decodeQrFromImageFile(file);
        if (!decodedQr) {
          setErrorMsg(t('qr_decode_failed'));
          return;
        }
        processRawText(decodedQr);
      } catch (err: any) {
        setErrorMsg(err.message || t('qr_decode_failed'));
      }
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        processRawText(text);
      };
      reader.onerror = () => setErrorMsg('Failed to read file');
      reader.readAsText(file);
    }
  };

  const processRawText = async (text: string, pwd?: string) => {
    setErrorMsg(null);
    try {
      const parsed = await parseImportString(text, pwd);
      setCandidates(parsed);
      setSelectedIds(new Set(parsed.map((a) => a.id)));
      setPasswordRequired(false);
    } catch (err: any) {
      if (err.message === 'PASSWORD_REQUIRED') {
        setRawJsonPayload(text);
        setPasswordRequired(true);
      } else {
        setErrorMsg(err.message || 'Import failed');
      }
    }
  };

  const handleUnlockBackup = async () => {
    if (!backupPassword) {
      setErrorMsg(t('password_empty'));
      return;
    }
    await processRawText(rawJsonPayload, backupPassword);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const selectAll = () => {
    setSelectedIds(new Set(candidates.map((c) => c.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleExecuteImport = () => {
    const toImport: AuthenticatorAccount[] = [];

    for (const item of candidates) {
      if (!selectedIds.has(item.id)) continue;

      const dup = checkDuplicate(item, existingAccounts);
      if (dup.isDuplicate && skipDuplicates) {
        continue;
      }
      toImport.push(item);
    }

    if (toImport.length === 0) {
      setErrorMsg('No accounts to import based on your selection.');
      return;
    }

    onImportComplete(toImport);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-2xl app-modal p-4 shadow-2xl flex flex-col gap-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Download size={18} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-100">
              {candidates.length > 0 ? t('import_preview_title') : t('export_import_center')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        {errorMsg && (
          <div className="p-2 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-200 flex items-start gap-1.5">
            <AlertCircle size={14} className="shrink-0 text-red-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {passwordRequired ? (
          <div className="flex flex-col gap-3 py-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center gap-2 text-slate-300">
              <Lock size={18} className="text-amber-400 shrink-0" />
              <span>This backup is encrypted with AES-256-GCM. Please enter the password to decrypt.</span>
            </div>
            <div>
              <label className="text-slate-300 font-medium mb-1 block">
                {t('backup_password_label')}
              </label>
              <input
                type="password"
                value={backupPassword}
                onChange={(e) => setBackupPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPasswordRequired(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleUnlockBackup}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
              >
                Decrypt & Import
              </button>
            </div>
          </div>
        ) : candidates.length === 0 ? (
          <div className="flex flex-col gap-3 py-2 text-xs">
            <input
              ref={fileInputRef}
              type="file"
              accept=".sauth,.json,image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-800/40 hover:bg-slate-800/70 transition-colors cursor-pointer text-center"
            >
              <Upload size={24} className="text-blue-400 mb-2" />
              <span className="text-xs font-semibold text-slate-200">
                Upload Backup File or QR Image
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                Supports .sauth, .json, and migration QR images
              </span>
            </button>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-300 font-medium flex items-center gap-1.5">
                <FileText size={13} className="text-slate-400" />
                <span>Or Paste URI / Raw Payload:</span>
              </label>
              <textarea
                rows={3}
                value={inputRaw}
                onChange={(e) => setInputRaw(e.target.value)}
                placeholder="Paste otpauth-migration://, otpauth://, or JSON..."
                className="w-full p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => processRawText(inputRaw)}
                disabled={!inputRaw.trim()}
                className="self-end px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium transition-colors"
              >
                Parse Payload
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-medium">
                {t('import_accounts_detected', { count: candidates.length })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAll}
                  className="text-blue-400 hover:text-blue-300 text-[11px]"
                >
                  Select All
                </button>
                <span className="text-slate-600">|</span>
                <button
                  onClick={deselectAll}
                  className="text-slate-400 hover:text-slate-300 text-[11px]"
                >
                  Deselect
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
              {candidates.map((item) => {
                const isSelected = selectedIds.has(item.id);
                const dup = checkDuplicate(item, existingAccounts);

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleSelect(item.id)}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-slate-800/90 border-blue-500/60'
                        : 'bg-slate-900 border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="mt-0.5 text-blue-400">
                      {isSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-100 truncate">
                          {item.issuer}
                        </span>
                        <span className="text-[10px] px-1 rounded bg-slate-700 text-slate-300">
                          {item.type.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-slate-400 block text-[11px] truncate">
                        {item.name}
                      </span>
                      {dup.isDuplicate && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-400">
                          <AlertTriangle size={11} />
                          <span>
                            {dup.duplicateType === 'exact'
                              ? t('duplicate_exact')
                              : t('duplicate_conflict')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/60 border border-slate-700/60">
              <input
                type="checkbox"
                id="skipDup"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="rounded text-blue-600 focus:ring-0"
              />
              <label htmlFor="skipDup" className="text-slate-300 cursor-pointer text-[11px]">
                {t('skip_duplicates')}
              </label>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-800">
              <button
                onClick={() => setCandidates([])}
                className="px-3 py-1.5 rounded-lg app-btn-secondary"
              >
                Back
              </button>
              <button
                onClick={handleExecuteImport}
                disabled={selectedIds.size === 0}
                className="px-4 py-1.5 rounded-lg app-btn-primary disabled:opacity-50 font-medium transition-colors"
              >
                {t('import_selected', { count: selectedIds.size })}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
