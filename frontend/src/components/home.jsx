import "./home.css";

function HomeIcon({ name, size = 22 }) {
  const common = {
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: "false",
  };

  const drawings = {
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M4 5.5v16M8 7h8M8 11h8" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    qr: <><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" /><path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18v2M20 20h-2" /></>,
    chart: <><path d="M4 20V11M10 20V5M16 20v-8M22 20H2" /><path d="m3 8 5-3 5 2 7-5" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    journals: <><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5z" /><path d="M5 4.5v17M9 6h7M9 10h7M2 5v14" /></>,
    student: <><path d="m2 9 10-5 10 5-10 5L2 9Z" /><path d="M6 11v5c3.5 3 8.5 3 12 0v-5M22 9v6" /></>,
  };

  return <svg {...common}>{drawings[name] || drawings.book}</svg>;
}
function Home({ onSelectRole }) {
  const features = [
    {
      icon: "book",
      title: "Book Catalog",
      description: "Browse and organize the library collection.",
    },
    {
      icon: "layers",
      title: "Borrowing & Returns",
      description: "Track requests, borrowed books, and returns.",
    },
    {
      icon: "qr",
      title: "QR Code Transactions",
      description: "Make library checkout and return processing easier.",
    },
  ];

  return (
    <main className="ls-home">
      <header className="ls-home-header">
        <a className="ls-home-brand" href="#home" aria-label="LibSync home">
          <img
            src="/libsync-logo.svg"
            alt="LibSync — School Library Management System"
          />
        </a>

        <nav className="ls-home-nav" aria-label="Main navigation">
          <a href="#home">Home</a>
          <a href="#about">About</a>
          <a href="#features">Features</a>
          <a href="#portals">Portals</a>
          <a href="#contact">Contact</a>
        </nav>

        <a className="ls-home-nav-cta" href="#portals">
          Get Started <HomeIcon name="arrow" size={17} />
        </a>
      </header>

      <section className="ls-home-hero" id="home">
        <div className="ls-home-hero-copy">
          <div className="ls-home-eyebrow">
            <span /> SCHOOL LIBRARY MANAGEMENT SYSTEM
          </div>

          <h1>
            A WORLD OF KNOWLEDGE,
            <br />
            <span>AT YOUR FINGERTIPS.</span>
          </h1>

          <p>
            Discover books, manage borrowing, and make library access
            simpler for every learner.
          </p>

          <div className="ls-home-hero-actions">
            <a className="ls-home-primary" href="#portals">
              Explore Portals <HomeIcon name="arrow" size={17} />
            </a>
            <a className="ls-home-secondary" href="#about">
              Learn More
            </a>
          </div>
        </div>

        <div
          className="ls-home-hero-photo"
          role="img"
          aria-label="Bright modern school library with bookshelves, reading tables, books, and a plant"
        >
          <div className="ls-home-hero-highlights">
            <div>
              <HomeIcon name="book" size={25} />
              <span>Organized<br />Collection</span>
            </div>
            <div>
              <HomeIcon name="layers" size={25} />
              <span>Easy<br />Borrowing</span>
            </div>
            <div>
              <HomeIcon name="chart" size={25} />
              <span>Smart<br />Tracking</span>
            </div>
          </div>
        </div>
      </section>

      <section className="ls-home-about" id="about">
        <div className="ls-home-section-heading">
          <div className="ls-home-eyebrow"><span /> WHY CHOOSE LIBSYNC</div>
          <h2>A Smarter Way to Manage Your Library</h2>
          <p>Everything your school library needs in one place.</p>
        </div>
        <div className="ls-home-feature-grid" id="features">
          {features.map((feature) => (
            <article className="ls-home-feature-card" key={feature.title}>
              <div className="ls-home-feature-icon">
                <HomeIcon name={feature.icon} size={28} />
              </div>
              <div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="ls-home-portals" id="portals">
        <div className="ls-home-section-heading">
          <div className="ls-home-eyebrow"><span /> CHOOSE YOUR PORTAL</div>
          <h2>Access Your Portal</h2>
          <p>Select your role to continue.</p>
        </div>

        <div className="ls-home-portal-grid">
          <article className="ls-home-portal-card">
            <div className="ls-home-portal-icon">
              <HomeIcon name="journals" size={32} />
            </div>
            <div className="ls-home-portal-copy">
              <h3>Librarian</h3>
              <p>Manage books, review requests, and track borrowing records.</p>
            </div>
            <button type="button" onClick={() => onSelectRole("Librarian")}>
              Librarian Login <HomeIcon name="arrow" size={17} />
            </button>
          </article>

          <article className="ls-home-portal-card">
            <div className="ls-home-portal-icon">
              <HomeIcon name="student" size={32} />
            </div>
            <div className="ls-home-portal-copy">
              <h3>Student</h3>
              <p>Browse books, select titles, and manage your borrowing activity.</p>
            </div>
            <button type="button" onClick={() => onSelectRole("Student")}>
              Student Login <HomeIcon name="arrow" size={17} />
            </button>
          </article>
        </div>
      </section>

      <section className="ls-home-contact" id="contact">
        <div className="ls-home-contact-inner">
          <div className="ls-home-eyebrow"><span /> STAY CONNECTED</div>
          <h2>Empowering learners through an accessible library.</h2>
          <p>
            For assistance with your LibSync account or library services,
            please contact your school library administrator.
          </p>
          <a href="#portals" className="ls-home-primary">
            Access Your Portal <HomeIcon name="arrow" size={17} />
          </a>
        </div>
      </section>

      <footer className="ls-home-footer">
        <div className="ls-home-footer-main">
          <a className="ls-home-footer-brand" href="#home" aria-label="LibSync home">
            <img src="/libsync-logo.svg" alt="LibSync" />
          </a>
          <p className="ls-home-footer-tagline">
            Empowering learners through an accessible and well-managed library.
          </p>
          <nav className="ls-home-footer-links" aria-label="Footer navigation">
            <a href="#home">Home</a>
            <a href="#about">About</a>
            <a href="#portals">Portals</a>
            <a href="#contact">Contact</a>
          </nav>
        </div>
        <div className="ls-home-footer-bottom">
          <span>© {new Date().getFullYear()} LibSync. All rights reserved.</span>
          <span>School Library Management System</span>
        </div>
      </footer>
    </main>
  );
}

export default Home;
