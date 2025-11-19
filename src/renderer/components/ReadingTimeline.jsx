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
      {/* Video Player Style Timeline */}
      <div className="space-y-3">
        {/* Main Timeline Container - More prominent like video player */}
        <div
          className="relative h-6 bg-cinema-gray rounded-full cursor-pointer hover:bg-cinema-gray-light transition-all duration-200 group shadow-inner"
          onClick={handleTimelineClick}
        >
          {/* Background track */}
          <div className="absolute inset-1 bg-black/20 rounded-full" />
          
          {/* Progress Fill - Like YouTube red progress */}
          <div
            className="absolute top-1 left-1 bottom-1 bg-cinema-accent rounded-full transition-all duration-100 shadow-sm"
            style={{ width: `calc(${currentPosition}% - 4px)` }}
          />

          {/* Page Markers (Vertical Ticks) - More visible */}
          {pageMarkers.map((marker) => (
            <div
              key={marker.page}
              className="absolute top-0 bottom-0 w-0.5 bg-white/40 hover:bg-cinema-accent hover:w-1 transition-all cursor-pointer group/marker z-10"
              style={{ left: `${marker.position}%` }}
              onClick={(e) => handlePageMarkerClick(e, marker.index)}
              title={`Page ${marker.page}`}
            >
              {/* Page Number Tooltip */}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-cinema-dark/95 px-3 py-1.5 rounded-md text-xs text-cinema-text whitespace-nowrap opacity-0 group-hover/marker:opacity-100 transition-opacity pointer-events-none border border-cinema-gray shadow-xl">
                <div className="font-bold text-cinema-accent">Page {marker.page}</div>
                <div className="text-cinema-text-dim">Click to jump</div>
              </div>
            </div>
          ))}

          {/* Current Position Indicator - More prominent playhead */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-cinema-accent border-2 border-white rounded-full shadow-lg transition-all duration-100 z-20 hover:scale-110"
            style={{ left: `${currentPosition}%`, transform: `translateX(-50%) translateY(-50%)` }}
          >
            {/* Inner dot for better visibility */}
            <div className="absolute inset-1 bg-white rounded-full" />
          </div>

          {/* Hover Preview with more detail */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-8 bg-cinema-dark/95 px-4 py-2 rounded-lg text-xs text-cinema-text whitespace-nowrap border border-cinema-gray shadow-xl">
              <div className="font-bold">Click to navigate</div>
              <div className="text-cinema-text-dim">Drag the timeline to scrub</div>
            </div>
          </div>
        </div>

        {/* Page Segments Display - Like YouTube chapters */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4 text-cinema-text-dim">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-cinema-accent/30 rounded-sm" />
              <span>Read ({Math.floor(currentPosition)}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-cinema-gray rounded-sm" />
              <span>Remaining ({100 - Math.floor(currentPosition)}%)</span>
            </div>
          </div>
          <div className="text-cinema-accent font-bold">
            {totalPages} Pages • {words.length.toLocaleString()} Words
          </div>
        </div>
      </div>
    </div>
  );
}
