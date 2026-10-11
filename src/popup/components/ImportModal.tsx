import React, { useState, useRef, useEffect } from "react";
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
  ExternalLink,
  RefreshCw,
  ArrowUpDown,
} from "lucide-react";
import { AuthenticatorAccount } from "../../types";
import { parseImportString, checkDuplicate } from "../../lib/import-export";
import { decodeQrFromImageFile } from "../../lib/qr-code";
import { t } from "../../lib/i18n";
import { ExportContent } from "./ExportModal";

interface ImportModalProps {
  existingAccounts: AuthenticatorAccount[];
  onImportComplete: (accounts: AuthenticatorAccount[]) => Promise<void> | void;
  onClose: () => void;
  preloadedAccounts?: AuthenticatorAccount[];
  autoTriggerPicker?: boolean;
  initialTab?: "import" | "export";
}

export const ImportModal: React.FC<ImportModalProps> = ({
  existingAccounts,
  onImportComplete,
  onClose,
  preloadedAccounts,
  autoTriggerPicker,
  initialTab = "import",
}) => {
  const [activeMainTab, setActiveMainTab] = useState<"import" | "export">(
    initialTab,
  );
  const [candidates, setCandidates] = useState<AuthenticatorAccount[]>(
    preloadedAccounts || [],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set((preloadedAccounts || []).map((a) => a.id)),
  );
  const [inputRaw, setInputRaw] = useState("");
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [backupPassword, setBackupPassword] = useState("");
  const [rawJsonPayload, setRawJsonPayload] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isPopup =
    typeof window !== "undefined" &&
    !window.location.pathname.includes("options.html");

  useEffect(() => {
    if (autoTriggerPicker && !preloadedAccounts?.length) {
      const timer = setTimeout(() => {
        fileInputRef.current?.click();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [autoTriggerPicker, preloadedAccounts]);

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    const isImage = file.type.startsWith("image/");
    if (isImage) {
      try {
        const decodedQr = await decodeQrFromImageFile(file);
        if (!decodedQr) {
          setErrorMsg(t("qr_decode_failed"));
          return;
        }
        await processRawText(decodedQr);
      } catch (err: any) {
        setErrorMsg(err.message || t("qr_decode_failed"));
      }
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        processRawText(text);
      };
      reader.onerror = () => setErrorMsg(t("file_read_error"));
      reader.readAsText(file);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await handleFile(file);
    }
  };

  const handleOpenFullTab = () => {
    if (typeof chrome !== "undefined" && chrome.tabs?.create) {
      chrome.tabs.create({
        url: chrome.runtime.getURL("options.html?import=1&picker=1"),
      });
    } else if (
      typeof chrome !== "undefined" &&
      chrome.runtime?.openOptionsPage
    ) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open("options.html?import=1&picker=1", "_blank");
    }
  };

  const handleUploadBoxClick = () => {
    if (isPopup) {
      handleOpenFullTab();
    } else {
      fileInputRef.current?.click();
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
      if (err.message === "PASSWORD_REQUIRED") {
        setRawJsonPayload(text);
        setPasswordRequired(true);
      } else {
        setErrorMsg(err.message || t("import_failed"));
      }
    }
  };

  const handleUnlockBackup = async () => {
    if (!backupPassword) {
      setErrorMsg(t("password_empty"));
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

  const handleExecuteImport = async () => {
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
      setErrorMsg(t("no_accounts_to_import"));
      return;
    }

    setIsImporting(true);
    setErrorMsg(null);
    try {
      await onImportComplete(toImport);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || t("import_failed"));
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/70 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-2xl app-modal p-4 shadow-2xl flex flex-col gap-2 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <ArrowUpDown size={18} className="app-text-accent" />
            <h3 className="text-sm font-semibold app-text-primary">
              {candidates.length > 0
                ? t("import_preview_title")
                : t("export_import_center")}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isImporting}
            className="app-btn-icon disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {candidates.length === 0 && !passwordRequired && (
          <div className="flex rounded-lg app-bg-subtle border border-[var(--border-subtle)] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveMainTab("import")}
              className={`flex-1 py-1.5 px-3 rounded-md font-medium flex items-center justify-center gap-1.5 transition-colors ${
                activeMainTab === "import"
                  ? "app-btn-primary shadow-xs"
                  : "app-text-secondary hover:app-text-primary"
              }`}
            >
              <Download size={13} />
              <span>{t("tab_import")}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMainTab("export")}
              className={`flex-1 py-1.5 px-3 rounded-md font-medium flex items-center justify-center gap-1.5 transition-colors ${
                activeMainTab === "export"
                  ? "app-btn-primary shadow-xs"
                  : "app-text-secondary hover:app-text-primary"
              }`}
            >
              <Upload size={13} />
              <span>{t("tab_export")}</span>
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-2 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-200 flex items-start gap-1.5">
            <AlertCircle size={14} className="shrink-0 text-red-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {passwordRequired ? (
          <div className="flex flex-col gap-2 py-2 text-xs">
            <div className="p-2.5 rounded-xl app-bg-subtle border border-[var(--border-subtle)] flex items-center gap-2 app-text-secondary">
              <Lock size={18} className="text-amber-400 shrink-0" />
              <span>
                This backup is encrypted with AES-256-GCM. Please enter the
                password to decrypt.
              </span>
            </div>
            <div>
              <label className="app-text-secondary font-medium mb-1 block">
                {t("backup_password_label")}
              </label>
              <input
                type="password"
                value={backupPassword}
                onChange={(e) => setBackupPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full px-2.5 py-1.5 rounded-lg app-input"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPasswordRequired(false)}
                className="px-3 py-1.5 rounded-lg app-btn-secondary"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleUnlockBackup}
                className="px-4 py-1.5 rounded-lg app-btn-primary font-medium"
              >
                Decrypt & Import
              </button>
            </div>
          </div>
        ) : candidates.length === 0 ? (
          activeMainTab === "export" ? (
            <ExportContent accounts={existingAccounts} />
          ) : (
            <div className="flex flex-col gap-2 py-2 text-xs">
            <input
              ref={fileInputRef}
              type="file"
              accept=".sauth,.json,image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleUploadBoxClick}
              className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed transition-colors cursor-pointer text-center ${
                isDragging
                  ? "border-[var(--accent)] bg-[var(--accent-glow)]"
                  : "border-[var(--border-subtle)] hover:border-[var(--accent)] app-bg-subtle hover:bg-[var(--bg-subtle-hover)]"
              }`}
            >
              <Upload size={24} className="app-text-accent mb-2" />
              <span className="text-xs font-semibold app-text-primary">
                {t("upload_backup_title")}
              </span>
              <span className="text-[10px] app-text-muted mt-0.5">
                {t("upload_backup_hint")}
              </span>
              <span className="text-[10px] app-text-accent font-medium mt-1">
                {isPopup ? t("open_tab_safe_notice") : t("drag_drop_hint")}
              </span>
            </div>

            {isPopup && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleOpenFullTab}
                  className="flex items-center gap-1 text-[11px] app-text-accent hover:opacity-80 transition-colors"
                >
                  <ExternalLink size={12} />
                  <span>{t("open_full_tab_label")}</span>
                </button>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="app-text-secondary font-medium flex items-center gap-1.5">
                <FileText size={13} className="app-text-muted" />
                <span>{t("paste_payload_label")}</span>
              </label>
              <textarea
                rows={3}
                value={inputRaw}
                onChange={(e) => setInputRaw(e.target.value)}
                placeholder={t("paste_placeholder")}
                className="w-full p-2 rounded-lg app-input font-mono text-[11px]"
              />
              <button
                onClick={() => processRawText(inputRaw)}
                disabled={!inputRaw.trim()}
                className="self-end px-3 py-1.5 rounded-lg app-btn-primary disabled:opacity-50 font-medium transition-colors"
              >
                {t("parse_payload_btn")}
              </button>
            </div>
          </div>
          )
        ) : (
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="app-text-secondary font-medium">
                {t("import_accounts_detected", { count: candidates.length })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAll}
                  disabled={isImporting}
                  className="app-text-accent hover:opacity-80 text-[11px] disabled:opacity-50"
                >
                  {t("select_all")}
                </button>
                <span className="app-text-muted">|</span>
                <button
                  onClick={deselectAll}
                  disabled={isImporting}
                  className="app-text-muted hover:app-text-primary text-[11px] disabled:opacity-50"
                >
                  {t("deselect_all")}
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
                    onClick={() => !isImporting && toggleSelect(item.id)}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? "border-[var(--accent)] app-bg-card"
                        : "border-[var(--border-subtle)] app-bg-subtle opacity-70"
                    }`}
                  >
                    <div className="mt-0.5 app-text-accent">
                      {isSelected ? (
                        <CheckSquare size={15} />
                      ) : (
                        <Square size={15} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold app-text-primary truncate">
                          {item.issuer}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded app-badge font-medium">
                          {item.type.toUpperCase()}
                        </span>
                      </div>
                      <span className="app-text-secondary block text-[11px] truncate">
                        {item.name}
                      </span>
                      {dup.isDuplicate && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-400">
                          <AlertTriangle size={11} />
                          <span>
                            {dup.duplicateType === "exact"
                              ? t("duplicate_exact")
                              : t("duplicate_conflict")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg app-bg-subtle border border-[var(--border-subtle)]">
              <input
                type="checkbox"
                id="skipDup"
                checked={skipDuplicates}
                disabled={isImporting}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="rounded accent-[var(--accent)] disabled:opacity-50"
              />
              <label
                htmlFor="skipDup"
                className="app-text-secondary cursor-pointer text-[11px]"
              >
                {t("skip_duplicates")}
              </label>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-[var(--border-subtle)]">
              <button
                onClick={() => setCandidates([])}
                disabled={isImporting}
                className="px-3 py-1.5 rounded-lg app-btn-secondary disabled:opacity-50"
              >
                {t("back")}
              </button>
              <button
                onClick={handleExecuteImport}
                disabled={selectedIds.size === 0 || isImporting}
                className="px-4 py-1.5 rounded-lg app-btn-primary disabled:opacity-50 font-medium transition-colors flex items-center gap-1.5"
              >
                {isImporting ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>
                      {t("importing_progress", { count: selectedIds.size })}
                    </span>
                  </>
                ) : (
                  <span>
                    {t("import_selected", { count: selectedIds.size })}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
