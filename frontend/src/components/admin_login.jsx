import { useState } from "react";

function AdminLogin({ onBack }) {
  const [loginError, setLoginError] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();

    setLoginError("");

    const form = e.target;
    const email = form.email.value.trim();
    const password = form.password.value;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const adminEmail = "admin@libsync.com";
    const adminPassword = "admin123";

    const isCorrectEmail =
      email.toLowerCase() ===
      adminEmail;

    const isCorrectPassword =
      password === adminPassword;

    if (!isCorrectEmail || !isCorrectPassword) {
      setLoginError(
        "Invalid email or password."
      );
      return;
    }

    console.log("Admin login successful");

    // Admin Dashboard natin ilalagay dito later
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
          <i className="bi bi-person-gear"></i>
        </div>

        <h1>Admin Login</h1>

        <p>
          Access the administrator portal
        </p>

        {loginError && (
          <div className="form-error">
            {loginError}
          </div>
        )}

        <form onSubmit={handleLogin}>

          <div className="form-group">
            <label>
              Email Address
            </label>

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
              name="password"
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

      </div>
    </div>
  );
}

export default AdminLogin;