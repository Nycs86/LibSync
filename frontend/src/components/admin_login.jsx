import { useState } from "react";

function AdminLogin({ onBack, onLoginSuccess }) {
  const [loginError, setLoginError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    setLoginError("");

    const form = e.target;
    const email = form.email.value.trim();
    const password = form.password.value;

    console.log("Admin login attempt");
    console.log("Email:", email);

    if (!form.checkValidity()) {
      console.log("Form validation failed");
      form.reportValidity();
      return;
    }

    try {
      console.log("Connecting to backend...");

      const response = await fetch(
        "https://identify-spilt-cover.ngrok-free.dev/api/login", {

          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      console.log("Backend response status:", response.status);

      const data = await response.json();

      console.log("Backend response:", data);

      if (!response.ok) {
        console.log("Login failed:", data.message);

        setLoginError(
          data.message || "Invalid email or password."
        );
        return;
      }

      if (data.user.role !== "admin") {
        console.log("Role check failed. User is not admin.");

        setLoginError(
          "This account is not registered as an admin."
        );
        return;
      }

      localStorage.setItem(
        "loggedInUser",
        JSON.stringify(data.user)
      );

      console.log("Admin login successful");
      console.log("Admin account:", data.user);

      onLoginSuccess();

    } catch (error) {
      console.error("Admin login error:", error);

      setLoginError(
        "Unable to connect to the server."
      );
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