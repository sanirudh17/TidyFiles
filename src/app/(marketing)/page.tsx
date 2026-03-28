"use client";

import { useEffect } from "react";
import Link from "next/link";
import "../marketing.css";

export default function LandingPage() {
  useEffect(() => {
    // Basic init logic from script.js translated to work within React
    const handleMobileMenu = () => {
        const mobileMenuToggle = document.querySelector(".mobile-menu-toggle");
        const mobileNav = document.querySelector(".site-nav-mobile");

        if (mobileMenuToggle && mobileNav) {
            mobileMenuToggle.addEventListener("click", () => {
                const isOpen = mobileNav.classList.toggle("is-open");
                mobileMenuToggle.setAttribute("aria-expanded", String(isOpen));
                const icon = mobileMenuToggle.querySelector("i");
                if (icon) {
                    icon.classList.toggle("fa-bars");
                    icon.classList.toggle("fa-xmark");
                }
            });

            mobileNav.querySelectorAll("a").forEach((link) => {
                link.addEventListener("click", () => {
                    mobileNav.classList.remove("is-open");
                    mobileMenuToggle.setAttribute("aria-expanded", "false");
                    const icon = mobileMenuToggle.querySelector("i");
                    if (icon) {
                        icon.classList.add("fa-bars");
                        icon.classList.remove("fa-xmark");
                    }
                });
            });
        }
    };

    const handleAnimations = () => {
        const animatedElements = document.querySelectorAll(".animate-up");
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("visible");
                    }
                });
            },
            { threshold: 0.16 }
        );

        animatedElements.forEach((element) => observer.observe(element));
    };

    const handleSmoothScroll = () => {
        document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
            anchor.addEventListener("click", (event) => {
                const targetId = anchor.getAttribute("href");
                if (!targetId || targetId === "#") {
                    return;
                }

                const target = document.querySelector(targetId);
                if (!target) {
                    return;
                }

                event.preventDefault();
                target.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        });
    };

    const handleFAQ = () => {
        document.querySelectorAll(".faq-question").forEach((button) => {
            // Remove previous event listeners by cloning
            const newButton = button.cloneNode(true) as HTMLElement;
            if(button.parentNode) {
                button.parentNode.replaceChild(newButton, button);
            }
            newButton.addEventListener("click", () => {
                const item = newButton.closest(".faq-item");
                if (!item) {
                    return;
                }
                const isOpen = item.classList.toggle("is-open");
                newButton.setAttribute("aria-expanded", String(isOpen));
            });
        });
    };

    handleMobileMenu();
    handleAnimations();
    handleSmoothScroll();
    handleFAQ();
  }, []);

  return (
    <>
      <header className="site-header">
        <div className="container nav-shell">
            <a href="#home" className="brand">
                <span className="brand-mark"><i className="fa-solid fa-folder-tree"></i></span>
                <span>
                    <strong>TidyFiles</strong>
                    <small>Safety-first file cleanup</small>
                </span>
            </a>
            <nav className="site-nav">
                <a href="#problem">Problem</a>
                <a href="#workflow">How it works</a>
                <a href="#features">Features</a>
                <a href="#safety">Safety</a>
                <a href="#faq">FAQ</a>
            </nav>
            <div className="nav-actions">
                <a href="/signin" className="btn btn-secondary">Sign in</a>
                <a href="/signup" className="btn btn-primary">Create account</a>
            </div>
            <button className="mobile-menu-toggle" type="button" aria-label="Toggle menu" aria-expanded="false">
                <i className="fa-solid fa-bars"></i>
            </button>
        </div>
        <nav className="site-nav-mobile">
            <a href="#problem">Problem</a>
            <a href="#workflow">How it works</a>
            <a href="#features">Features</a>
            <a href="#safety">Safety</a>
            <a href="#faq">FAQ</a>
        </nav>
    </header>

    <main>
        <section className="hero-section" id="home">
            <div className="hero-glow hero-glow-left"></div>
            <div className="hero-glow hero-glow-right"></div>
            <div className="container hero-grid">
                <div className="hero-copy animate-up">
                    <div className="eyebrow">Built for messy local folders</div>
                    <h1>Clean up messy folders with review-first AI.</h1>
                    <p className="hero-subtitle">
                        Scan Downloads, Desktop, Documents, and project folders. Review suggestions for duplicates,
                        naming issues, moves, and archives before anything changes.
                    </p>
                    <div className="hero-actions">
                        <a href="/signup" className="btn btn-primary btn-large">Get started</a>
                        <a href="#workflow" className="btn btn-secondary btn-large">View workflow</a>
                    </div>
                    <div className="trust-pills">
                        <span><i className="fa-solid fa-shield-heart"></i> Review first</span>
                        <span><i className="fa-solid fa-clock-rotate-left"></i> Undo-aware history</span>
                        <span><i className="fa-solid fa-database"></i> Backup ready</span>
                    </div>
                </div>

                <div className="hero-panel animate-up delay-100">
                    <div className="app-shell">
                        <div className="app-sidebar">
                            <div className="sidebar-title">Scan Setup</div>
                            <div className="sidebar-item active">
                                <i className="fa-solid fa-download"></i>
                                <span>Downloads</span>
                                <b>1,238 files</b>
                            </div>
                            <div className="sidebar-item">
                                <i className="fa-solid fa-desktop"></i>
                                <span>Desktop</span>
                                <b>342 files</b>
                            </div>
                            <div className="sidebar-item">
                                <i className="fa-solid fa-folder-open"></i>
                                <span>Client Assets</span>
                                <b>587 files</b>
                            </div>
                            <div className="sidebar-footer">
                                <span>Cleanup score</span>
                                <strong>72 / 100</strong>
                            </div>
                        </div>
                        <div className="app-main">
                            <div className="app-topbar">
                                <div>
                                    <p className="panel-label">Suggestions</p>
                                    <h2>14 actions ready for review</h2>
                                </div>
                                <span className="status-chip status-chip-safe">Nothing changes automatically</span>
                            </div>
                            <div className="stats-row">
                                <div className="stat-card">
                                    <span className="stat-label">Duplicates</span>
                                    <strong>23</strong>
                                    <small>4.8 GB reclaimable</small>
                                </div>
                                <div className="stat-card">
                                    <span className="stat-label">Naming Issues</span>
                                    <strong>41</strong>
                                    <small>Copies and unclear names</small>
                                </div>
                                <div className="stat-card">
                                    <span className="stat-label">Protected</span>
                                    <strong>9</strong>
                                    <small>Skipped automatically</small>
                                </div>
                            </div>
                            <div className="suggestion-table">
                                <div className="table-row table-head">
                                    <span>File</span>
                                    <span>Action</span>
                                    <span>Score</span>
                                    <span>Review</span>
                                </div>
                                <div className="table-row">
                                    <span className="mono">invoice-shot.png</span>
                                    <span>Rename for context</span>
                                    <span><em className="confidence good">92%</em></span>
                                    <button className="row-action" type="button">Approve</button>
                                </div>
                                <div className="table-row">
                                    <span className="mono">setup-4.exe</span>
                                    <span>Move to Installers</span>
                                    <span><em className="confidence medium">76%</em></span>
                                    <button className="row-action" type="button">Inspect</button>
                                </div>
                                <div className="table-row">
                                    <span className="mono">meeting-final.mp4</span>
                                    <span>Archive old large file</span>
                                    <span><em className="confidence good">88%</em></span>
                                    <button className="row-action" type="button">Review</button>
                                </div>
                            </div>
                            <div className="approval-bar">
                                <div>
                                    <p className="panel-label">Review summary</p>
                                    <strong>3 actions approved, backups enabled</strong>
                                </div>
                                <a href="/signup" className="btn btn-primary">Start scan</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section className="problem-section" id="problem">
            <div className="container section-shell section-shell-split">
                <div className="section-heading animate-up">
                    <div className="eyebrow">The problem</div>
                    <h2>Most folders get messy because cleanup feels slow and risky.</h2>
                    <p>
                        People do not avoid cleanup because they cannot drag files into folders. They avoid it because
                        duplicates, vague filenames, and mixed personal/work files make every delete or rename feel unsafe.
                    </p>
                </div>
                <div className="before-after-grid">
                    <article className="compare-card compare-card-before animate-up delay-100">
                        <span className="compare-tag compare-tag-danger">Before</span>
                        <h3>Chaotic folder reality</h3>
                        <ul className="compare-list">
                            <li>Loose screenshots and unclear file names everywhere</li>
                            <li>Downloads mixed with installers, exports, invoices, and temp files</li>
                            <li>Duplicates and old archives taking up space without visibility</li>
                            <li>No confidence about what is safe to move or delete</li>
                        </ul>
                    </article>
                    <article className="compare-card compare-card-after animate-up delay-200">
                        <span className="compare-tag compare-tag-safe">After</span>
                        <h3>Calm, reviewable cleanup</h3>
                        <ul className="compare-list">
                            <li>Grouped file categories, timeline context, and cleanup score</li>
                            <li>Renames, moves, archives, and deletions proposed with explanations</li>
                            <li>Approvals, confirmations, and backups before destructive actions</li>
                            <li>History log and undo-aware checks after changes are applied</li>
                        </ul>
                    </article>
                </div>
            </div>
        </section>

        <section className="workflow-section" id="workflow">
            <div className="container section-shell section-shell-split">
                <div className="section-heading animate-up">
                    <div className="eyebrow">How it works</div>
                    <h2>Scan first. Review second. Apply only what you trust.</h2>
                </div>
                <div className="workflow-grid">
                    <article className="workflow-card animate-up delay-100">
                        <div className="workflow-number">1</div>
                        <h3>Choose folders</h3>
                        <p>Add Downloads, Desktop, Documents, or any custom path you want to analyze.</p>
                    </article>
                    <article className="workflow-card animate-up delay-200">
                        <div className="workflow-number">2</div>
                        <h3>See what is inside</h3>
                        <p>Get file composition, duplicate counts, naming issues, timeline context, and cleanup score.</p>
                    </article>
                    <article className="workflow-card animate-up delay-300">
                        <div className="workflow-number">3</div>
                        <h3>Review smart suggestions</h3>
                        <p>Inspect renames, moves, deletes, and archives with confidence scores and reasoning.</p>
                    </article>
                    <article className="workflow-card animate-up delay-400">
                        <div className="workflow-number">4</div>
                        <h3>Approve and track changes</h3>
                        <p>Enable backups, confirm risky actions, and revisit operation history later.</p>
                    </article>
                </div>
            </div>
        </section>

        <section className="features-section" id="features">
            <div className="container section-shell section-shell-split">
                <div className="section-heading animate-up">
                    <div className="eyebrow">Feature groups</div>
                    <h2>Everything the app needs to prove value and build trust.</h2>
                </div>
                <div className="feature-columns">
                    <article className="feature-group animate-up delay-100">
                        <div className="feature-group-icon"><i className="fa-solid fa-chart-column"></i></div>
                        <h3>Understand the mess</h3>
                        <p>Scan results show category composition, cleanup score, duplicate counts, naming issues, and searchable file data.</p>
                        <ul>
                            <li>Recursive multi-folder scan setup</li>
                            <li>Global search with indexed lookup</li>
                            <li>Timeline and category dashboards</li>
                        </ul>
                    </article>
                    <article className="feature-group animate-up delay-200">
                        <div className="feature-group-icon"><i className="fa-solid fa-wand-magic-sparkles"></i></div>
                        <h3>Get smart suggestions</h3>
                        <p>AI and rules propose renames, duplicate cleanup, move recommendations, archive actions, and screenshot labeling.</p>
                        <ul>
                            <li>Confidence scores and explanations</li>
                            <li>Image and screenshot naming</li>
                            <li>Bulk approve and reject actions</li>
                        </ul>
                    </article>
                    <article className="feature-group animate-up delay-300">
                        <div className="feature-group-icon"><i className="fa-solid fa-shield"></i></div>
                        <h3>Stay in control</h3>
                        <p>The product is built around review-first behavior, confirmations, backups, and protected-file awareness.</p>
                        <ul>
                            <li>Nothing changes until approval</li>
                            <li>Confirmation flow for destructive actions</li>
                            <li>History log and undo status checks</li>
                        </ul>
                    </article>
                    <article className="feature-group animate-up delay-400">
                        <div className="feature-group-icon"><i className="fa-solid fa-folder-tree"></i></div>
                        <h3>Organize beyond cleanup</h3>
                        <p>Plan folder structure, export snapshots, and ask the AI assistant questions about scanned files.</p>
                        <ul>
                            <li>Folder structure proposals</li>
                            <li>Exportable HTML reports</li>
                            <li>Chat assistant for folder questions</li>
                        </ul>
                    </article>
                </div>
            </div>
        </section>

        <section className="safety-section" id="safety">
            <div className="container safety-grid">
                <div className="section-heading animate-up">
                    <div className="eyebrow">Trust and safety</div>
                    <h2>This product only works if users believe their files are safe.</h2>
                    <p>
                        File cleanup is high-anxiety. The landing page needs to show that TidyFiles is not blind automation.
                        It is a guided review workflow with clear safeguards.
                    </p>
                </div>
                <div className="safety-cards">
                    <article className="safety-card animate-up delay-100">
                        <i className="fa-solid fa-user-check"></i>
                        <h3>Approval before apply</h3>
                        <p>Suggestions stay in review until the user explicitly approves them.</p>
                    </article>
                    <article className="safety-card animate-up delay-200">
                        <i className="fa-solid fa-hard-drive"></i>
                        <h3>Backups and confirmations</h3>
                        <p>Destructive actions can require confirmation and backup coverage first.</p>
                    </article>
                    <article className="safety-card animate-up delay-300">
                        <i className="fa-solid fa-file-shield"></i>
                        <h3>Protected-file awareness</h3>
                        <p>System and sensitive files are surfaced differently to reduce risky mistakes.</p>
                    </article>
                    <article className="safety-card animate-up delay-400">
                        <i className="fa-solid fa-clock-rotate-left"></i>
                        <h3>History and undo checks</h3>
                        <p>Every operation is logged and later evaluated for safe, partial, or unsafe undo.</p>
                    </article>
                </div>
            </div>
        </section>

        <section className="use-cases-section">
            <div className="container section-shell">
                <div className="section-heading animate-up">
                    <div className="eyebrow">Use cases</div>
                    <h2>Useful for the folders people actually avoid opening.</h2>
                </div>
                <div className="use-case-grid">
                    <article className="use-case-card animate-up delay-100">
                        <h3>Downloads cleanup</h3>
                        <p>Sort installers, duplicate downloads, exports, and old attachments before they pile up.</p>
                    </article>
                    <article className="use-case-card animate-up delay-200">
                        <h3>Screenshot naming</h3>
                        <p>Rename screenshots and image exports into labels that are readable later.</p>
                    </article>
                    <article className="use-case-card animate-up delay-300">
                        <h3>Client file hygiene</h3>
                        <p>Standardize filenames and move loose assets into reliable folder structure.</p>
                    </article>
                    <article className="use-case-card animate-up delay-400">
                        <h3>Archive and reclaim space</h3>
                        <p>Identify stale, large files and duplicates before long-term storage or backup runs.</p>
                    </article>
                </div>
            </div>
        </section>

        <section className="faq-section" id="faq">
            <div className="container section-shell">
                <div className="section-heading animate-up">
                    <div className="eyebrow">FAQ</div>
                    <h2>Answer the trust questions directly.</h2>
                </div>
                <div className="faq-list">
                    <article className="faq-item animate-up delay-100">
                        <button className="faq-question" type="button" aria-expanded="false">
                            <span>Does TidyFiles change files automatically?</span>
                            <i className="fa-solid fa-plus"></i>
                        </button>
                        <div className="faq-answer">
                            <p>No. The workflow is review-first. Suggestions are generated, then approved by the user before anything is applied.</p>
                        </div>
                    </article>
                    <article className="faq-item animate-up delay-200">
                        <button className="faq-question" type="button" aria-expanded="false">
                            <span>Can I review suggestions before deletes or moves?</span>
                            <i className="fa-solid fa-plus"></i>
                        </button>
                        <div className="faq-answer">
                            <p>Yes. Renames, moves, archives, and deletions are surfaced in a review queue with confidence and rationale.</p>
                        </div>
                    </article>
                    <article className="faq-item animate-up delay-300">
                        <button className="faq-question" type="button" aria-expanded="false">
                            <span>Does it support backups and undo?</span>
                            <i className="fa-solid fa-plus"></i>
                        </button>
                        <div className="faq-answer">
                            <p>Backups can be enabled before destructive actions, and the history system records operations with later undo-safety checks.</p>
                        </div>
                    </article>
                    <article className="faq-item animate-up delay-400">
                        <button className="faq-question" type="button" aria-expanded="false">
                            <span>What kinds of folders is it best for?</span>
                            <i className="fa-solid fa-plus"></i>
                        </button>
                        <div className="faq-answer">
                            <p>It is best suited for messy Windows folders like Downloads, Desktop, Documents, screenshots, and mixed project assets.</p>
                        </div>
                    </article>
                </div>
            </div>
        </section>
    </main>

    <footer className="site-footer">
        <div className="container footer-shell">
            <div>
                <a href="#home" className="brand brand-footer">
                    <span className="brand-mark"><i className="fa-solid fa-folder-tree"></i></span>
                    <span>
                        <strong>TidyFiles</strong>
                        <small>Safe AI cleanup for local folders</small>
                    </span>
                </a>
            </div>
            <div className="footer-links">
                <a href="/signin">Sign In</a>
                <a href="/signup">Sign Up</a>
                <a href="#faq">FAQ</a>
            </div>
        </div>
    </footer>
    </>
  );
}
