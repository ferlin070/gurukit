import { Component } from "react";
import { reportClientError } from "../lib/report-error.js";
export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    reportClientError("UI_RENDER_ERROR");
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="page notfound">
        <h1>Ruang kerja terganggu</h1>
        <p>
          Perubahan terakhir mungkin belum disimpan. Muat semula halaman untuk
          mencuba lagi.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => window.location.reload()}
        >
          Muat semula
        </button>{" "}
        <a className="btn btn-ghost" href="/support">
          Bantuan
        </a>
      </main>
    );
  }
}
