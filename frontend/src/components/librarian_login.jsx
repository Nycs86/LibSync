import { useState } from "react";

function LibrarianLogin({ onBack, onLoginSuccess }) {
  const [loginError, setLoginError] = useState("");

  const API_URL = "https://libsync-backend.onrender.com";

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");

    const form = e.target;
    const email = form.email.value.trim();
    const password = form.loginPassword.value;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          role: "librarian",
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setLoginError(
          data.message || "Invalid email or password."
        );
        return;
      }

      if (!data.user || data.user.role !== "librarian") {
        setLoginError(
          "This account is not registered as a librarian."
        );
        return;
      }

      localStorage.setItem(
        "loggedInUser",
        JSON.stringify(data.user)
      );

      console.log("Librarian login successful");
      console.log("Librarian account:", data.user);

      onLoginSuccess();
    } catch (error) {
      console.error("Librarian login error:", error);
      setLoginError("Unable to connect to the server.");
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <button
          type="button"
          className="back-button"
          onClick={onBack}
        >
          Back
        </button>

        <div className="login-icon">
          <i className="bi bi-book"></i>
        </div>

        <h1>Librarian Login</h1>

        <p>Access your LibSync librarian account</p>

        {loginError && (
          <div className="form-error">
            {loginError}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email Address</label>

            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>

            <input
              type="password"
              name="loginPassword"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            className="login-button"
          >
            Login
          </button>
        </form>

        <div className="register-link">
          Librarian accounts are managed by the administrator.
        </div>
      </div>
    </div>
  );
}

export default LibrarianLogin;
