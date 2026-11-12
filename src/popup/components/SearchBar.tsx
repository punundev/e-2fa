import React, { useState, useRef, useEffect } from "react";
import { Search, X, ChevronsUpDown, Check, Globe } from "lucide-react";
import { t } from "../../lib/i18n";
import { BrandLogo } from "./BrandLogo";

interface SearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  selectedGroup: string;
  onGroupChange: (g: string) => void;
  availableGroups: string[];
  selectedPlatform: string;
  onPlatformChange: (p: string) => void;
  availablePlatforms: string[];
  groupCounts?: Record<string, number>;
  platformCounts?: Record<string, number>;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  query,
  onQueryChange,
  selectedGroup,
  onGroupChange,
  availableGroups,
  selectedPlatform,
  onPlatformChange,
  availablePlatforms,
  groupCounts = {},
  platformCounts = {},
}) => {
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [platformSearch, setPlatformSearch] = useState("");
  const comboboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        comboboxRef.current &&
        !comboboxRef.current.contains(e.target as Node)
      ) {
        setComboboxOpen(false);
      }
    };
    if (comboboxOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [comboboxOpen]);

  const filteredPlatforms = availablePlatforms.filter((p) =>
    p.toLowerCase().includes(platformSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-2 mb-3">
      {/* Search Input Row with Shadcn-style Platform Combobox */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1 flex items-center">
          <Search
            size={16}
            className="absolute left-3 app-text-muted pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t("search_placeholder")}
            className="w-full pl-9 pr-8 h-8 text-xs rounded-lg app-input placeholder:opacity-60"
          />
          {query && (
            <button
              onClick={() => onQueryChange("")}
              className="absolute right-2 p-0.5 rounded app-text-muted hover:opacity-100"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Shadcn-style Platform Combobox Dropdown */}
        {availablePlatforms.length > 0 && (
          <div className="relative shrink-0" ref={comboboxRef}>
            <button
              type="button"
              onClick={() => setComboboxOpen(!comboboxOpen)}
              className={`h-8 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs ${
                selectedPlatform !== "All"
                  ? "app-btn-primary border-transparent"
                  : "app-btn-secondary border-[var(--border-subtle)]"
              }`}
              title="Filter by platform"
            >
              <div className="flex items-center gap-1 max-w-[100px] truncate">
                {selectedPlatform !== "All" && (
                  <BrandLogo issuer={selectedPlatform} size={13} />
                )}
                <span className="truncate">
                  {selectedPlatform === "All"
                    ? "Platform"
                    : selectedPlatform}
                </span>
              </div>
              <ChevronsUpDown size={12} className="shrink-0 opacity-60" />
            </button>

            {/* Combobox Popover */}
            {comboboxOpen && (
              <div className="absolute right-0 top-9.5 z-50 w-52 rounded-xl app-modal border border-[var(--border-subtle)] shadow-xl p-1.5 flex flex-col gap-1 text-xs">
                {/* Search input inside combobox */}
                <div className="relative flex items-center px-1">
                  <Search
                    size={13}
                    className="absolute left-2.5 app-text-muted pointer-events-none"
                  />
                  <input
                    type="text"
                    autoFocus
                    value={platformSearch}
                    onChange={(e) => setPlatformSearch(e.target.value)}
                    placeholder="Search platform..."
                    className="w-full pl-6 pr-6 h-7 text-xs rounded-md app-input placeholder:opacity-50"
                  />
                  {platformSearch && (
                    <button
                      onClick={() => setPlatformSearch("")}
                      className="absolute right-2 app-text-muted"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>

                <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5 pt-1">
                  {/* All Platforms option */}
                  <button
                    type="button"
                    onClick={() => {
                      onPlatformChange("All");
                      setComboboxOpen(false);
                      setPlatformSearch("");
                    }}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-left transition-colors ${
                      selectedPlatform === "All"
                        ? "app-btn-primary font-medium"
                        : "hover:app-bg-subtle app-text-primary"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Globe size={13} className="shrink-0 opacity-70" />
                      <span>{t("all_platforms")}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {typeof platformCounts["All"] === "number" && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                            selectedPlatform === "All"
                              ? "bg-white/20 text-white"
                              : "app-bg-subtle app-text-muted"
                          }`}
                        >
                          {platformCounts["All"]}
                        </span>
                      )}
                      {selectedPlatform === "All" && (
                        <Check size={13} className="shrink-0 text-white" />
                      )}
                    </div>
                  </button>

                  {/* Filtered platforms list */}
                  {filteredPlatforms.map((platform) => {
                    const isSelected = selectedPlatform === platform;
                    const count = platformCounts[platform];
                    return (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => {
                          onPlatformChange(platform);
                          setComboboxOpen(false);
                          setPlatformSearch("");
                        }}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-left transition-colors ${
                          isSelected
                            ? "app-btn-primary font-medium"
                            : "hover:app-bg-subtle app-text-primary"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <BrandLogo issuer={platform} size={14} />
                          <span className="truncate">{platform}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {typeof count === "number" && (
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                                isSelected
                                  ? "bg-white/20 text-white"
                                  : "app-bg-subtle app-text-muted"
                              }`}
                            >
                              {count}
                            </span>
                          )}
                          {isSelected && (
                            <Check size={13} className="shrink-0 text-white" />
                          )}
                        </div>
                      </button>
                    );
                  })}

                  {filteredPlatforms.length === 0 && (
                    <div className="py-2 text-center app-text-muted text-[11px]">
                      No platform found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Group Pills (All, Pinned, etc) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
        {[
          "All",
          "Pinned",
          ...availableGroups.filter((g) => g !== "All" && g !== "Pinned"),
        ].map((grp) => {
          const count = groupCounts[grp];
          return (
            <button
              key={grp}
              onClick={() => onGroupChange(grp)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 whitespace-nowrap transition-colors ${
                selectedGroup === grp
                  ? "app-btn-primary font-medium shadow-xs"
                  : "app-btn-secondary"
              }`}
            >
              <span>
                {grp === "All"
                  ? t("filter_all")
                  : grp === "Pinned"
                    ? t("filter_pinned")
                    : grp}
              </span>
              {typeof count === "number" && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    selectedGroup === grp
                      ? "bg-white/20 text-white"
                      : "app-bg-subtle app-text-muted"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
