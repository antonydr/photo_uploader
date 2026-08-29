import { useEffect, useState, useCallback, useRef } from "react";
import "./Gallery.css";
import { supabase } from "../lib/supabase";

const BUCKET_NAME = "wedding-photos";
const POOL_LIMIT = 30;
const PAGE_SIZE = 24;
const NUM_SLOTS = 6;
const MIN_INTERVAL_MS = 2500;
const MAX_INTERVAL_MS = 5500;
const FADE_MS = 450;

function isVideo(name, mimetype) {
  if (mimetype) return mimetype.startsWith("video/");
  return /\.(mp4|mov|webm|avi|m4v)$/i.test(name);
}

function randomInterval() {
  return MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
}

export default function Gallery() {
  const [pool, setPool] = useState([]);
  const [loadingPool, setLoadingPool] = useState(true);
  const [error, setError] = useState("");

  const [showAll, setShowAll] = useState(false);
  const [allFiles, setAllFiles] = useState([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const [lightboxIndex, setLightboxIndex] = useState(null);

  // Which pool-index each visible slot currently shows, and whether it's mid-fade
  const [slotItems, setSlotItems] = useState([]);
  const [slotFading, setSlotFading] = useState([]);

  const timeoutsRef = useRef([]);
  const pausedRef = useRef(false);
  const scheduleSlotRef = useRef(() => {});

  const toItem = useCallback((f) => {
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(f.name);
    return {
      name: f.name,
      url: data.publicUrl,
      video: isVideo(f.name, f.metadata?.mimetype),
    };
  }, []);

  // Load the pool used for the shuffling wall
  useEffect(() => {
    let cancelled = false;
    async function loadPool() {
      setLoadingPool(true);
      const { data, error: listError } = await supabase.storage
        .from(BUCKET_NAME)
        .list("", { limit: POOL_LIMIT, sortBy: { column: "created_at", order: "desc" } });

      if (cancelled) return;
      if (listError) {
        setError("Couldn't load the gallery right now.");
      } else {
        setPool((data || []).map(toItem));
      }
      setLoadingPool(false);
    }
    loadPool();
    return () => {
      cancelled = true;
    };
  }, [toItem]);

  // Set up the shuffling wall whenever the pool changes
  useEffect(() => {
    timeoutsRef.current.forEach((t) => t && clearTimeout(t));
    timeoutsRef.current = [];

    if (pool.length === 0) {
      setSlotItems([]);
      setSlotFading([]);
      return undefined;
    }

    const slotCount = Math.min(NUM_SLOTS, pool.length);
    const initial = Array.from({ length: slotCount }, (_, i) => i % pool.length);
    setSlotItems(initial);
    setSlotFading(new Array(slotCount).fill(false));
    timeoutsRef.current = new Array(slotCount).fill(null);

    // Nothing extra to shuffle in if the pool isn't bigger than what's visible
    if (pool.length <= slotCount) {
      scheduleSlotRef.current = () => {};
      return undefined;
    }

    const scheduleSlot = (slotIdx) => {
      if (pausedRef.current) return;
      const outerTimeout = setTimeout(() => {
        if (pausedRef.current) return;
        setSlotFading((prev) => {
          const next = [...prev];
          next[slotIdx] = true;
          return next;
        });

        setTimeout(() => {
          if (pausedRef.current) return;
          setSlotItems((prev) => {
            const shown = new Set(prev);
            let candidate = Math.floor(Math.random() * pool.length);
            let attempts = 0;
            while (shown.has(candidate) && attempts < 6) {
              candidate = Math.floor(Math.random() * pool.length);
              attempts += 1;
            }
            const next = [...prev];
            next[slotIdx] = candidate;
            return next;
          });
          setSlotFading((prev) => {
            const next = [...prev];
            next[slotIdx] = false;
            return next;
          });
          scheduleSlot(slotIdx);
        }, FADE_MS);
      }, randomInterval());

      timeoutsRef.current[slotIdx] = outerTimeout;
    };

    scheduleSlotRef.current = scheduleSlot;

    for (let i = 0; i < slotCount; i += 1) {
      scheduleSlot(i);
    }

    return () => {
      timeoutsRef.current.forEach((t) => t && clearTimeout(t));
      timeoutsRef.current = [];
    };
  }, [pool]);

  // Pause the wall while a photo is open full-size, and resume where it left off on close
  useEffect(() => {
    pausedRef.current = lightboxIndex !== null;

    if (pausedRef.current) {
      timeoutsRef.current.forEach((t) => t && clearTimeout(t));
      timeoutsRef.current = timeoutsRef.current.map(() => null);
    } else {
      timeoutsRef.current.forEach((t, i) => {
        if (!t) scheduleSlotRef.current(i);
      });
    }
  }, [lightboxIndex]);

  const loadMore = useCallback(async () => {
    setLoadingAll(true);
    const { data, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list("", { limit: PAGE_SIZE, offset, sortBy: { column: "created_at", order: "desc" } });

    if (!listError && data) {
      setAllFiles((prev) => [...prev, ...data.map(toItem)]);
      setOffset((prev) => prev + data.length);
      setHasMore(data.length === PAGE_SIZE);
    } else {
      setError("Couldn't load more photos.");
    }
    setLoadingAll(false);
  }, [offset, toItem]);

  const openGallery = () => {
    setShowAll(true);
    if (allFiles.length === 0) loadMore();
  };

  const closeGallery = () => {
    setShowAll(false);
    setLightboxIndex(null);
  };

  const activeList = showAll ? allFiles : pool;

  return (
    <section className="gallery-section">
      <h2 className="gallery-title">Guest Photos & Videos</h2>

      {error && <p className="photo-error">{error}</p>}

      {!loadingPool && pool.length === 0 && !error && (
        <p className="gallery-empty">No photos uploaded yet — be the first!</p>
      )}

      {pool.length > 0 && (
        <>
          <div className="gallery-carousel">
            {slotItems.map((poolIdx, slotIdx) => {
              const item = pool[poolIdx];
              if (!item) return null;
              return (
                <button
                  key={slotIdx}
                  type="button"
                  className={`gallery-thumb carousel-slot${slotFading[slotIdx] ? " fading" : ""}`}
                  onClick={() => {
                    setShowAll(false);
                    setLightboxIndex(poolIdx);
                  }}
                >
                  {item.video ? (
                    <video src={item.url} muted playsInline preload="metadata" />
                  ) : (
                    <img src={item.url} alt="" loading="lazy" />
                  )}
                  {item.video && <span className="play-icon">▶</span>}
                </button>
              );
            })}
          </div>

          <button type="button" className="view-all-btn" onClick={openGallery}>
            View All Photos
          </button>
        </>
      )}

      {showAll && (
        <div className="gallery-modal" onClick={closeGallery}>
          <div className="gallery-modal-inner" onClick={(e) => e.stopPropagation()}>
            <div className="gallery-modal-header">
              <h3>All Photos & Videos</h3>
              <button type="button" className="gallery-close" onClick={closeGallery}>
                ✕
              </button>
            </div>

            <div className="gallery-grid">
              {allFiles.map((item, i) => (
                <button
                  key={item.name}
                  type="button"
                  className="gallery-thumb"
                  onClick={() => setLightboxIndex(i)}
                >
                  {item.video ? (
                    <video src={item.url} muted playsInline preload="metadata" />
                  ) : (
                    <img src={item.url} alt="" loading="lazy" />
                  )}
                  {item.video && <span className="play-icon">▶</span>}
                </button>
              ))}
            </div>

            {hasMore && (
              <button
                type="button"
                className="load-more-btn"
                onClick={loadMore}
                disabled={loadingAll}
              >
                {loadingAll ? "Loading..." : "Load More"}
              </button>
            )}
          </div>
        </div>
      )}

      {lightboxIndex !== null && activeList[lightboxIndex] && (
        <div className="lightbox" onClick={() => setLightboxIndex(null)}>
          <button type="button" className="lightbox-close" onClick={() => setLightboxIndex(null)}>
            ✕
          </button>

          {lightboxIndex > 0 && (
            <button
              type="button"
              className="lightbox-nav lightbox-prev"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((i) => i - 1);
              }}
            >
              ‹
            </button>
          )}
          {lightboxIndex < activeList.length - 1 && (
            <button
              type="button"
              className="lightbox-nav lightbox-next"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((i) => i + 1);
              }}
            >
              ›
            </button>
          )}

          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            {activeList[lightboxIndex].video ? (
              <video src={activeList[lightboxIndex].url} controls autoPlay playsInline />
            ) : (
              <img src={activeList[lightboxIndex].url} alt="" />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
