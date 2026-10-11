import React from "react";
import { Search, X } from "lucide-react";
import { t } from "../../lib/i18n";

interface SearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  selectedGroup: string;
  onGroupChange: (g: string) => void;
  availableGroups: string[];
}

export const SearchBar: React.FC<SearchBarProps> = ({
  query,
  onQueryChange,
  selectedGroup,
  onGroupChange,
  availableGroups,
}) => {
  return (
    <div className="flex flex-col gap-2 mb-3">
      <div className="relative flex items-center">
        <Search
          size={16}
          className="absolute left-3 app-text-muted pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("search_placeholder")}
          className="w-full pl-9 pr-8 h-8 text-sm rounded-lg app-input placeholder:opacity-60"
        />
        {query && (
          <button
            onClick={() => onQueryChange("")}
            className="absolute right-2.5 p-0.5 rounded app-text-muted hover:opacity-100"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
        {[
          "All",
          "Pinned",
          ...availableGroups.filter((g) => g !== "All" && g !== "Pinned"),
        ].map((grp) => (
          <button
            key={grp}
            onClick={() => onGroupChange(grp)}
            className={`px-2.5 py-1 whitespace-nowrap transition-colors ${
              selectedGroup === grp
                ? "app-btn-primary font-medium shadow-xs"
                : "app-btn-secondary"
            }`}
          >
            {grp === "All"
              ? t("filter_all")
              : grp === "Pinned"
                ? t("filter_pinned")
                : grp}
          </button>
        ))}
      </div>
    </div>
  );
};
