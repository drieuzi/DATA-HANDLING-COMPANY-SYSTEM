import { Component } from "react";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, details) {
    console.error("Illuminux interface error", error, details);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-error-screen">
          <section>
            <p>Illuminux Company Management System</p>
            <h1>The page could not display a saved record.</h1>
            <span>Your data request may already have been saved. Reload to retrieve the latest records safely.</span>
            <button type="button" onClick={() => window.location.reload()}>Reload Website</button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
