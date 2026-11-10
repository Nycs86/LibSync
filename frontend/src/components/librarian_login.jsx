import { useState } from "react";
import "./librarian_login.css";

import { api, saveAuthSession } from "../services/api";

function LibrarianLogin({ onBack, onLoginSuccess }) {
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");

    const form = e.currentTarget;
    const email = form.email.value.trim();
    const password = form.loginPassword.value;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    try {
      setIsLoading(true);

      const data = await api.post("/api/login", {
        email,
        password,
        role: "librarian",
      });

      if (!data.user || data.user.role?.toLowerCase() !== "librarian") {
        setLoginError(
          "This account is not registered as a librarian."
        );
        return;
      }

      // Save JWT token and user information
      saveAuthSession(data, rememberMe);

      // Notify App.jsx
      onLoginSuccess(data.user);

    } catch (error) {
      console.error("Librarian login error:", error);

      if (error.status === 401) {
        setLoginError("Invalid email or password.");
      } else if (error.status === 403) {
        setLoginError(
          error.message ||
          "You are not authorized to access this account."
        );
      } else {
        setLoginError(
          error.message ||
          "Unable to connect to the server. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setLoginError(
      "Please contact the administrator to reset your librarian password."
    );
  };

  return (
    <main className="ls-login-page">
      <section
        className="ls-login-card"
        aria-label="LibSync librarian login"
      >

        <aside
          className="ls-login-visual"
          style={{ backgroundImage: 'url("/libsync_background.png")' }}
          aria-label="LibSync library branding"
        >
          <button
            type="button"
            className="ls-login-back"
            onClick={onBack}
            aria-label="Back to Home"
          >
            <i className="bi bi-arrow-left" aria-hidden="true"></i>
            <span>Back to Home</span>
          </button>
        </aside>

        <section className="ls-login-form-panel">
          <div className="ls-login-content">
            <div className="ls-login-badge">LIBRARIAN PORTAL</div>

            <h1>Welcome Back</h1>

            <p className="ls-login-subtitle">
              Sign in to manage your library.
            </p>

            {loginError && (
              <div className="ls-login-error" role="alert">
                <i
                  className="bi bi-exclamation-circle-fill"
                  aria-hidden="true"
                ></i>
                <span>{loginError}</span>
              </div>
            )}

            <form className="ls-login-form" onSubmit={handleLogin}>
              <div className="ls-login-field">
                <label htmlFor="librarian-email">
                  Email Address
                </label>

                <div className="ls-login-input-wrap">
                  <i
                    className="bi bi-envelope"
                    aria-hidden="true"
                  ></i>

                  <input
                    id="librarian-email"
                    type="email"
                    name="email"
                    placeholder="Enter your email address"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="ls-login-field">
                <label htmlFor="librarian-password">
                  Password
                </label>

                <div className="ls-login-input-wrap">
                  <i
                    className="bi bi-lock"
                    aria-hidden="true"
                  ></i>

                  <input
                    id="librarian-password"
                    type={showPassword ? "text" : "password"}
                    name="loginPassword"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />

                  <button
                    type="button"
                    className="ls-password-toggle"
                    onClick={() =>
                      setShowPassword((current) => !current)
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    <i
                      className={`bi ${
                        showPassword ? "bi-eye-slash" : "bi-eye"
                      }`}
                      aria-hidden="true"
                    ></i>
                  </button>
                </div>
              </div>

              <div className="ls-login-options">
                <label className="ls-remember-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) =>
                      setRememberMe(e.target.checked)
                    }
                  />

                  <span
                    className="ls-custom-checkbox"
                    aria-hidden="true"
                  ></span>

                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  className="ls-forgot-link"
                  onClick={handleForgotPassword}
                >
                  Forgot password?
                </button>
              </div>

              <button
                className="ls-login-submit"
                type="submit"
                disabled={isLoading}
              >
                <span>
                  {isLoading ? "Signing in..." : "Login"}
                </span>
              </button>
            </form>

            <div className="ls-librarian-notice">
              <i
                className="bi bi-shield-lock"
                aria-hidden="true"
              ></i>

              <span>
                Librarian accounts are managed by the administrator.
              </span>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

export default LibrarianLogin;

