"use strict";

(function () {
  document.addEventListener('DOMContentLoaded', function() {

    // Scroll reveal
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // Phone bar animations
    const phoneObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          setTimeout(() => {
            const fa = document.getElementById('phone-bar-fa');
            const xp = document.getElementById('phone-bar-xp');
            if (fa) fa.style.width = '47%';
            if (xp) xp.style.width = '71%';
          }, 400);
          phoneObserver.unobserve(e.target);
        }
      });
    }, { threshold: 0.5 });

    const phone = document.querySelector('.phone');
    if (phone) phoneObserver.observe(phone);

    // Streak animation
    const streakEl = document.getElementById('streak-counter');
    let streakAnimated = false;

    const streakObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting && !streakAnimated) {
          streakAnimated = true;
          let current = 0;
          const target = 47;
          const step = () => {
            current = Math.min(current + 2, target);
            if (streakEl) streakEl.textContent = current;
            if (current < target) requestAnimationFrame(step);
          };
          setTimeout(() => requestAnimationFrame(step), 200);
          streakObserver.unobserve(e.target);
        }
      });
    }, { threshold: 0.5 });

    if (streakEl) streakObserver.observe(streakEl);

    // Form submission handler
    window.submitForm = function(type) {
      const email = document.getElementById(type + '-email');
      if (!email) return;

      const val = email.value.trim();
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

      if (!valid) {
        email.style.borderColor = 'rgba(240,85,85,.5)';
        email.focus();
        setTimeout(() => { email.style.borderColor = ''; }, 2000);
        return;
      }

      const wrap = document.getElementById(type + '-form-wrap') || document.getElementById(type === 'hero' ? 'hero-form-wrap' : 'cta-form-wrap');
      const success = document.getElementById(type + '-success');

      if (wrap) {
        wrap.style.opacity  = '0';
        wrap.style.transform = 'translateY(-8px)';
        wrap.style.transition = 'opacity .3s, transform .3s';
        setTimeout(() => {
          wrap.style.display = 'none';
          if (success) {
            success.style.display = 'flex';
            requestAnimationFrame(() => success.classList.add('show'));
          }
        }, 300);
      }

      // Persist signup locally
      saveSignup(val, type);
    };

    function saveSignup(email, type) {
      try {
        const arr = JSON.parse(localStorage.getItem('levelupmoney_signups') || '[]');
        arr.push({ email: email, type: type, ts: Date.now() });
        localStorage.setItem('levelupmoney_signups', JSON.stringify(arr));
      } catch (err) {
        console.error('Signup persistence error', err);
      }
    }

    // Enter key triggers
    document.querySelectorAll('input[type="email"]').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const id = input.id;
          if (id === 'hero-email') submitForm('hero');
          if (id === 'cta-email')  submitForm('cta');
        }
      });
    });

  });
})();
