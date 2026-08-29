import { useState, useRef } from "react";
import "./PhotoUpload.css";
import { supabase } from "../lib/supabase";

const BUCKET_NAME = "wedding-photos";
const MAX_FILE_SIZE_MB = 50;

export default function PhotoUpload() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files || []);
    setError("");
    setDone(false);

    const tooBig = selected.filter((f) => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    const okFiles = selected.filter((f) => f.size <= MAX_FILE_SIZE_MB * 1024 * 1024);

    if (tooBig.length > 0) {
      setError(
        `${tooBig.length} file${tooBig.length > 1 ? "s were" : " was"} over ${MAX_FILE_SIZE_MB}MB and skipped.`
      );
    }

    setFiles(okFiles);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError("");

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgressText(`Uploading ${i + 1} of ${files.length}...`);

      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        setError(`Something went wrong uploading "${file.name}". Please try again.`);
        setUploading(false);
        setProgressText("");
        return;
      }
    }

    setUploading(false);
    setProgressText("");
    setDone(true);
    setFiles([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="photo-upload-card">
      {done ? (
        <div className="success-screen">
          <h3>Thank you! 💕</h3>
          <p>Your files have been uploaded. Feel free to add more anytime.</p>
          <button type="button" className="upload-more-btn" onClick={() => setDone(false)}>
            Upload More
          </button>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileSelect}
            id="photo-input"
            className="photo-input"
          />
          <label htmlFor="photo-input" className="photo-input-label">
            {files.length > 0
              ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
              : "Choose Photos or Videos"}
          </label>

          {error && <p className="photo-error">{error}</p>}

          <button
            type="button"
            className="photo-submit"
            disabled={files.length === 0 || uploading}
            onClick={handleUpload}
          >
            {uploading
              ? progressText || "Uploading..."
              : files.length > 0
              ? `Upload ${files.length} file${files.length > 1 ? "s" : ""}`
              : "Upload"}
          </button>
        </>
      )}
    </div>
  );
}
