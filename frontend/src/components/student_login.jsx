import { useState } from "react";

function StudentLogin({ onBack }) {
  const [showRegister, setShowRegister] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();

    setLoginError("");

    const form = e.target;
    const loginId = form.loginId.value.trim();
    const password = form.loginPassword.value;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const registeredStudent = JSON.parse(
      localStorage.getItem("studentAccount")
    );

    if (!registeredStudent) {
      setLoginError(
        "Account not found. Please register first."
      );
      return;
    }

    const isCorrectAccount =
      loginId.toLowerCase() ===
        registeredStudent.email.toLowerCase() ||
      loginId === registeredStudent.studentId;

    const isCorrectPassword =
      password === registeredStudent.password;

    if (!isCorrectAccount || !isCorrectPassword) {
      setLoginError(
        "Invalid Student ID/email or password."
      );
      return;
    }

    console.log("Student login successful");

    // Dashboard natin ilalagay dito later
  };

  const handleRegister = (e) => {
    e.preventDefault();

    setRegisterError("");
    setRegisterSuccess("");

    const form = e.target;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const studentId = form.studentId.value.trim();
    const fullName = form.fullName.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;

    if (password !== confirmPassword) {
      setRegisterError(
        "Passwords do not match."
      );
      return;
    }

    const existingStudent = JSON.parse(
      localStorage.getItem("studentAccount")
    );

    if (existingStudent) {
      if (
        existingStudent.studentId === studentId
      ) {
        setRegisterError(
          "Student ID is already registered."
        );
        return;
      }

      if (
        existingStudent.email.toLowerCase() ===
        email.toLowerCase()
      ) {
        setRegisterError(
          "Email address is already registered."
        );
        return;
      }
    }

    const studentAccount = {
      studentId,
      fullName,
      email,
      password,
    };

    localStorage.setItem(
      "studentAccount",
      JSON.stringify(studentAccount)
    );

    setRegisterSuccess(
      "Account created successfully! You can now login."
    );

    form.reset();
  };

  if (showRegister) {
    return (
      <div className="login-page">
        <div className="login-card">

          <button
            type="button"
            className="back-button"
            onClick={() => {
              setShowRegister(false);
              setRegisterError("");
              setRegisterSuccess("");
            }}
          >
            Back to Login
          </button>

          <div className="login-icon">
            <i className="bi bi-person-plus"></i>
          </div>

          <h1>Student Registration</h1>

          <p>
            Create your LibSync student account
          </p>

          {registerError && (
            <div className="form-error">
              {registerError}
            </div>
          )}

          {registerSuccess && (
            <div className="form-success">
              {registerSuccess}
            </div>
          )}

          <form onSubmit={handleRegister}>

            <div className="form-group">
              <label>Student ID</label>

              <input
                type="text"
                name="studentId"
                placeholder="Enter your student ID"
                required
              />
            </div>

            <div className="form-group">
              <label>Full Name</label>

              <input
                type="text"
                name="fullName"
                placeholder="Enter your full name"
                required
              />
            </div>

            <div className="form-group">
              <label>Email Address</label>

              <input
                type="email"
                name="email"
                placeholder="Enter your email address"
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>

              <input
                type="password"
                name="password"
                placeholder="Create a password"
                minLength="8"
                required
              />
            </div>

            <div className="form-group">
              <label>Confirm Password</label>

              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm your password"
                minLength="8"
                required
              />
            </div>

            <button
              type="submit"
              className="login-button"
            >
              Create Account
            </button>

          </form>

          <div className="register-link">
            Already have an account?{" "}

            <button
              type="button"
              onClick={() => {
                setShowRegister(false);
                setRegisterError("");
                setRegisterSuccess("");
              }}
            >
              Login
            </button>
          </div>

        </div>
      </div>
    );
  }

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
          <i className="bi bi-mortarboard"></i>
        </div>

        <h1>Student Login</h1>

        <p>
          Access your LibSync student account
        </p>

        {loginError && (
          <div className="form-error">
            {loginError}
          </div>
        )}

        <form onSubmit={handleLogin}>

          <div className="form-group">
            <label>
              Student ID or Email Address
            </label>

            <input
              type="text"
              name="loginId"
              placeholder="Enter your ID or email"
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
          Don't have an account?{" "}

          <button
            type="button"
            onClick={() => {
              setShowRegister(true);
              setLoginError("");
            }}
          >
            Register
          </button>
        </div>

      </div>
    </div>
  );
}

export default StudentLogin;