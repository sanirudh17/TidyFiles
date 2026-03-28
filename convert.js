const fs = require('fs');

function htmlToJsx(html) {
  return html
    .replace(/class=/g, 'className=')
    .replace(/for=/g, 'htmlFor=')
    .replace(/<img([^>]*[^/])>/gi, '<img$1 />')
    .replace(/<input([^>]*[^/])>/gi, '<input$1 />')
    .replace(/<br([^>]*[^/])>/gi, '<br$1 />')
    .replace(/<hr([^>]*[^/])>/gi, '<hr$1 />')
    .replace(/charset=/gi, 'charSet=');
}

function extractBody(html) {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (match) {
    let bodyContent = match[1];
    // Remove scripts at the end if any
    bodyContent = bodyContent.replace(/<script[^>]*>.*?<\/script>/gi, '');
    return bodyContent.trim();
  }
  return '';
}

function processFile(inputFile, outputFile, componentName) {
  const html = fs.readFileSync(inputFile, 'utf-8');
  let bodyContent = extractBody(html);
  
  // Specific to standard unclosed tags if there remain any, but <input> <img/> are mostly what we care about.
  let jsxContent = htmlToJsx(bodyContent);
  
  const finalCode = `"use client";

import { useEffect } from "react";
import Link from "next/link";
import "../marketing.css";

export default function ${componentName}() {
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
            const newButton = button.cloneNode(true);
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
      ${jsxContent}
    </>
  );
}
`;
  // Replace links
  const withNextLinks = finalCode
    .replace(/href="signup\.html"/g, 'href="/signup"')
    .replace(/href="signin\.html"/g, 'href="/signin"')
    .replace(/href="index\.html"/g, 'href="/"');

  fs.writeFileSync(outputFile, withNextLinks);
  console.log('Converted ' + inputFile + ' to ' + outputFile);
}

processFile('C:/sanir/Gemini CLI test/updated_version/index.html', 'C:/Users/sanir/Test OP/file-organizer/src/app/(marketing)/page.tsx', 'LandingPage');
processFile('C:/sanir/Gemini CLI test/updated_version/signin.html', 'C:/Users/sanir/Test OP/file-organizer/src/app/(marketing)/signin/page.tsx', 'SignInPage');
processFile('C:/sanir/Gemini CLI test/updated_version/signup.html', 'C:/Users/sanir/Test OP/file-organizer/src/app/(marketing)/signup/page.tsx', 'SignUpPage');

