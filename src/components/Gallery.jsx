import { useEffect, useState, useCallback } from "react";
import "./Gallery.css";
import { supabase } from "../lib/supabase";

const BUCKET_NAME = "wedding-photos";
const PREVIEW_COUNT = 12;
const PAGE_SIZE = 24;

function isVideo(name, mimetype) {
  if (mimetype) return mimetype.startsWith("video/");
  return /\.(mp4|mov|webm|avi|m4v)$/i.test(name);
}

export default function Gallery() {
  const [previewFiles, setPreviewFiles] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [error, setError] = useState("");

  const [showAll, setShowAll] = useState(false);
  const [allFiles, setAllFiles] = useState([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const [lightboxIndex, setLightboxIndex] = useState(null);

  const toItem = useCallback((f) => {
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(f.name);
    return {
      name: f.name,
      url: data.publicUrl,
      video: isVideo(f.name, f.metadata?.mimetype),
    };
  }, []);

  // Load the small preview strip on first render
  useEffect(() => {
    let cancelled = false;
    async function loadPreview() {
      setLoadingPreview(true);
      const { data, error: listError } = await supabase.storage
        .from(BUCKET_NAME)
        .list("", { limit: PREVIEW_COUNT, sortBy: { column: "created_at", order: "desc" } });

      if (cancelled) return;
      if (listError) {
        setError("Couldn't load the gallery right now.");
      } else {
        setPreviewFiles((data || []).map(toItem));
      }
      setLoadingPreview(false);
    }
    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [toItem]);

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

  const activeList = showAll ? allFiles : previewFiles;

  return (
    <section className="gallery-section">
      <h2 className="gallery-title">Guest Photos & Videos</h2>

      {error && <p className="photo-error">{error}</p>}

      {!loadingPreview && previewFiles.length === 0 && !error && (
        <p className="gallery-empty">No photos uploaded yet — be the first!</p>
      )}

      {previewFiles.length > 0 && (
        <>
          <div className="gallery-strip">
            {previewFiles.map((item, i) => (
              <button
                key={item.name}
                type="button"
                className="gallery-thumb"
                onClick={() => {
                  setShowAll(false);
                  setLightboxIndex(i);
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
