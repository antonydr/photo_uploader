import PhotoUpload from "./components/PhotoUpload";
import Gallery from "./components/Gallery";
import "./App.css";

function App() {
  return (
    <main className="app">
      <header className="app-header">
        <h1 className="couple-name">Sophie & Kieran</h1>
        <p className="subtitle">
          Thank you for being part of our day! If you snapped any photos or
          videos, we'd love to see them — upload them below.
        </p>
      </header>

      <PhotoUpload />
      <Gallery />

      <footer className="app-footer">
        <p>With love, Sophie & Kieran 💕</p>
      </footer>
    </main>
  );
}

export default App;
