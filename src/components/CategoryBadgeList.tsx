import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CategoryBadgeListProps {
  tags?: string[];
  maxInitial?: number;
}

export const CategoryBadgeList: React.FC<CategoryBadgeListProps> = ({ tags, maxInitial = 1 }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!tags || tags.length === 0) {
    return <span className="text-slate-400 text-[10px] font-medium">—</span>;
  }

  // If tags count <= maxInitial, just render all
  if (tags.length <= maxInitial) {
    return (
      <div className="flex flex-wrap gap-1">
        {tags.map((tag, idx) => (
          <span
            key={idx}
            className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200/80 leading-snug break-words max-w-[180px]"
          >
            {tag}
          </span>
        ))}
      </div>
    );
  }

  const hiddenCount = tags.length - maxInitial;

  return (
    <div
      onClick={(e) => {
        // Stop propagation so clicking category doesn't trigger table row selection
        e.stopPropagation();
      }}
      className="flex flex-wrap items-center gap-1"
    >
      {/* Display initial tag(s) */}
      {tags.slice(0, maxInitial).map((tag, idx) => (
        <span
          key={idx}
          className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200/80 leading-snug break-words max-w-[180px]"
        >
          {tag}
        </span>
      ))}

      {/* If expanded, show remaining tags and Collapse button */}
      {isExpanded ? (
        <>
          {tags.slice(maxInitial).map((tag, idx) => (
            <span
              key={idx + maxInitial}
              className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200/80 leading-snug break-words max-w-[180px]"
            >
              {tag}
            </span>
          ))}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(false);
            }}
            className="px-1.5 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-extrabold border border-slate-300 transition-all cursor-pointer inline-flex items-center gap-0.5"
            title="Згорнути список категорій"
          >
            <span>Згорнути</span>
            <ChevronUp className="w-2.5 h-2.5 text-slate-600" />
          </button>
        </>
      ) : (
        /* If collapsed, show '+N ще' toggle button */
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(true);
          }}
          className="px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-700 text-[10px] font-extrabold border border-blue-200/90 transition-all cursor-pointer inline-flex items-center gap-0.5 shadow-2xs"
          title={`Показати всі ${tags.length} категорій`}
        >
          <span>+{hiddenCount} ще</span>
          <ChevronDown className="w-2.5 h-2.5 text-blue-600" />
        </button>
      )}
    </div>
  );
};
