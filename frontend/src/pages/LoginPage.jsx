import { useState } from "react";
import Header from "../components/Header.jsx";
import { login } from "../services/authApi.js";

const initialFields = {
  username: "",
  password: ""
};

export default function LoginPage({ onLogin }) {
  const [fields, setFields] = useState(initialFields);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setFields((current) => ({ ...current, [name]: value }));
    setMessage({ type: "", text: "" });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const username = fields.username.trim();

    if (username.length < 3 || fields.password.length < 8) {
      setMessage({
        type: "error",
        text: "Enter a username of at least 3 characters and a password of at least 8 characters."
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const authenticatedUser = await login({
        username,
        password: fields.password
      });

      setMessage({ type: "success", text: "Login successful." });
      onLogin(authenticatedUser);
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Unable to log in. Please try again."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="app-page login-page">
      <Header />

      <main className="login-main">
        <section className="auth-card" aria-labelledby="loginTitle">
          <div className="auth-card__inner">
            <h1 className="login-title" id="loginTitle">
              Log In
            </h1>

            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <div className={`field-group ${fields.username ? "has-value" : ""}`}>
                <label htmlFor="loginUsername">Username</label>
                <input
                  id="loginUsername"
                  name="username"
                  type="text"
                  autoComplete="username"
                  minLength="3"
                  maxLength="50"
                  value={fields.username}
                  onChange={updateField}
                  required
                />
              </div>

              <div className={`field-group password-field ${fields.password ? "has-value" : ""}`}>
                <label htmlFor="loginPassword">Password</label>
                <input
                  id="loginPassword"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  minLength="8"
                  value={fields.password}
                  onChange={updateField}
                  required
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              <p className={`form-message ${message.type}`} role="status">
                {message.text}
              </p>

              <button className="submit-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Logging in…" : "Log In"}
              </button>
            </form>

            <p className="login-helper">
              Enter your account details to access the company system.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
