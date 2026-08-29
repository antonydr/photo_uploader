import { useEffect, useState, useCallback, useMemo } from "react";
import "./Gallery.css";
import { supabase } from "../lib/supabase";

const BUCKET_NAME = "wedding-photos";
const POOL_LIMIT = 30;
const PAGE_SIZE = 24;
const MIN_BELT_LENGTH = 8; // minimum tiles per loop, so a small pool still feels full
const SECONDS_PER_TILE = 3.5; // higher = slower scroll

function isVideo(name, mimetype) {
  if (mimetype) return mimetype.startsWith("video/");
  return /\.(mp4|mov|webm|avi|m4v)$/i.test(name);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
  const [hovered, setHovered] = useState(false);

  const toItem = useCallback((f) => {
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(f.name);
    return {
      name: f.name,
      url: data.publicUrl,
      video: isVideo(f.name, f.metadata?.mimetype),
    };
  }, []);

  // Load and shuffle the pool used for the marquee
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
        setPool(shuffle((data || []).map(toItem)));
      }
      setLoadingPool(false);
    }
    loadPool();
    return () => {
      cancelled = true;
    };
  }, [toItem]);

  // One shuffled "loop" of tiles, padded out so a small pool still fills the belt
  const beltSequence = useMemo(() => {
    if (pool.length === 0) return [];
    const seq = [];
    while (seq.length < MIN_BELT_LENGTH) {
      seq.push(...shuffle(pool));
    }
    return seq.map((item, i) => ({ ...item, poolIndex: pool.indexOf(item), key: `belt-${i}` }));
  }, [pool]);

  // The track renders the loop twice back-to-back so the animation can loop seamlessly
  const trackItems = useMemo(
    () => [
      ...beltSequence,
      ...beltSequence.map((item, i) => ({ ...item, key: `belt-dup-${i}` })),
    ],
    [beltSequence]
  );

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
  const isPaused = hovered || lightboxIndex !== null || showAll;

  return (
    <section className="gallery-section">
      <h2 className="gallery-title">Guest Photos & Videos</h2>

      {error && <p className="photo-error">{error}</p>}

      {!loadingPool && pool.length === 0 && !error && (
        <p className="gallery-empty">No photos uploaded yet — be the first!</p>
      )}

      {pool.length > 0 && (
        <>
          <div
            className="gallery-carousel-wrap"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <div
              className="gallery-carousel-track"
              style={{
                animationDuration: `${beltSequence.length * SECONDS_PER_TILE}s`,
                animationPlayState: isPaused ? "paused" : "running",
              }}
            >
              {trackItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="carousel-tile"
                  onClick={() => {
                    setShowAll(false);
                    setLightboxIndex(item.poolIndex);
                  }}
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
