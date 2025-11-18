import React from 'react';

/**
 * ReadingTimeline - YouTube-style scrubber with page markers
 * Allows navigation through screenplay with visual page boundaries
 */
export default function ReadingTimeline({ words, currentWordIndex, onSeek }) {
  if (!words || words.length === 0) return null;

  // Calculate page boundaries for vertical markers
  const pageMarkers = [];
  const totalPages = words[words.length - 1]?.page || 1;
  
  // Find first word of each page
  for (let page = 1; page <= totalPages; page++) {
    const firstWordIndex = words.findIndex(w => w.page === page);
    if (firstWordIndex !== -1) {
      pageMarkers.push({
        page,
        index: firstWordIndex,
        position: (firstWordIndex / words.length) * 100,
      });
    }
  }

  // Calculate current position percentage
  const currentPosition = (currentWordIndex / words.length) * 100;

  // Get current page info
  const currentWord = words[currentWordIndex];
  const currentPage = currentWord?.page || 1;

  // Handle click on timeline
  const handleTimelineClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    const targetIndex = Math.floor((percentage / 100) * words.length);
    onSeek(Math.max(0, Math.min(words.length - 1, targetIndex)));
  };

  // Handle page marker click
  const handlePageMarkerClick = (e, index) => {
    e.stopPropagation();
    onSeek(index);
  };

  return (
    <div className="bg-cinema-dark border-t border-cinema-gray px-6 py-4">
      {/* Page and Progress Info */}
      <div className="flex items-center justify-between mb-2 text-xs text-cinema-text-dim">
        <div>
          Page <span className="text-cinema-accent font-bold">{currentPage}</span> of {totalPages}
        </div>
        <div>
          Word <span className="text-cinema-accent font-bold">{currentWordIndex + 1}</span> of {words.length}
        </div>
        <div>{currentPosition.toFixed(1)}% Complete</div>
      </div>

      {/* Timeline Container */}
      <div
        className="relative h-10 bg-cinema-gray rounded-lg cursor-pointer hover:bg-cinema-gray-light transition-colors group"
        onClick={handleTimelineClick}
      >
        {/* Progress Fill */}
        <div
          className="absolute top-0 left-0 h-full bg-cinema-accent/30 rounded-lg transition-all duration-100"
          style={{ width: `${currentPosition}%` }}
        />

        {/* Current Position Indicator */}
        <div
          className="absolute top-0 h-full w-1 bg-cinema-accent shadow-lg transition-all duration-100"
          style={{ left: `${currentPosition}%` }}
        >
          {/* Playhead Handle */}
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-8 bg-cinema-accent rounded-full shadow-xl" />
        </div>

        {/* Page Markers (Vertical Ticks) */}
        {pageMarkers.map((marker) => (
          <div
            key={marker.page}
            className="absolute top-0 h-full w-px bg-cinema-text-dim/30 hover:bg-cinema-accent hover:w-0.5 transition-all cursor-pointer group/marker"
            style={{ left: `${marker.position}%` }}
            onClick={(e) => handlePageMarkerClick(e, marker.index)}
            title={`Page ${marker.page}`}
          >
            {/* Page Number Tooltip (shown on hover) */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-cinema-dark px-2 py-1 rounded text-xs text-cinema-text whitespace-nowrap opacity-0 group-hover/marker:opacity-100 transition-opacity pointer-events-none">
              Page {marker.page}
            </div>
          </div>
        ))}

        {/* Hover Preview (show word count on hover) */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-cinema-dark/90 px-3 py-1 rounded text-xs text-cinema-text whitespace-nowrap">
            Click to seek
          </div>
        </div>
      </div>

      {/* Timeline Stats */}
      <div className="mt-2 flex items-center justify-between text-xs text-cinema-text-dim">
        <div>
          {Math.floor((currentWordIndex / words.length) * 100)}% read
        </div>
        <div>
          {words.length - currentWordIndex} words remaining
        </div>
      </div>
    </div>
  );
}
