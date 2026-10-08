(() => {
    function initMobileMenu() {
        const menuToggle = document.querySelector('.menu-toggle');
        const navbar = document.querySelector('.navbar');
        const navLinks = document.querySelectorAll('.nav-menu a');

        if (!menuToggle || !navbar) return;

        menuToggle.addEventListener('click', () => {
            const isOpen = navbar.classList.toggle('active');
            menuToggle.setAttribute('aria-expanded', String(isOpen));
            menuToggle.textContent = isOpen ? '✕' : '☰';
        });

        navLinks.forEach((link) => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    navbar.classList.remove('active');
                    menuToggle.setAttribute('aria-expanded', 'false');
                    menuToggle.textContent = '☰';
                }
            });
        });
    }

    function initHeaderContrast() {
        const header = document.querySelector('.header');
        const targets = header?.querySelectorAll('.logo-name, .logo-tagline, .nav-menu a');
        if (!header || !targets?.length) return;

        const sampleSize = 32;
        const imageSamples = new WeakMap();
        let updateFrame = 0;

        function getImageLuminance(image, x, y) {
            if (!image.complete || !image.naturalWidth || !image.naturalHeight) return null;

            let sample = imageSamples.get(image);
            if (!sample) {
                const canvas = document.createElement('canvas');
                canvas.width = sampleSize;
                canvas.height = sampleSize;
                const context = canvas.getContext('2d', { willReadFrequently: true });
                try {
                    context.drawImage(image, 0, 0, sampleSize, sampleSize);
                    sample = context.getImageData(0, 0, sampleSize, sampleSize).data;
                    imageSamples.set(image, sample);
                } catch {
                    return null;
                }
            }

            const rect = image.getBoundingClientRect();
            if (!rect.width || !rect.height) return null;

            let scaleX = rect.width / image.naturalWidth;
            let scaleY = rect.height / image.naturalHeight;
            const fit = getComputedStyle(image).objectFit;
            if (fit === 'cover' || fit === 'contain') {
                const scale = fit === 'cover'
                    ? Math.max(scaleX, scaleY)
                    : Math.min(scaleX, scaleY);
                scaleX = scale;
                scaleY = scale;
            }

            const offsetX = (rect.width - image.naturalWidth * scaleX) / 2;
            const offsetY = (rect.height - image.naturalHeight * scaleY) / 2;
            const imageX = (x - rect.left - offsetX) / scaleX;
            const imageY = (y - rect.top - offsetY) / scaleY;
            if (imageX < 0 || imageY < 0 || imageX >= image.naturalWidth || imageY >= image.naturalHeight) return null;

            const pixelX = Math.min(sampleSize - 1, Math.floor(imageX / image.naturalWidth * sampleSize));
            const pixelY = Math.min(sampleSize - 1, Math.floor(imageY / image.naturalHeight * sampleSize));
            const index = (pixelY * sampleSize + pixelX) * 4;
            const alpha = sample[index + 3] / 255;
            const red = sample[index] * alpha + 255 * (1 - alpha);
            const green = sample[index + 1] * alpha + 255 * (1 - alpha);
            const blue = sample[index + 2] * alpha + 255 * (1 - alpha);
            return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
        }

        function getColorLuminance(color) {
            const values = color.match(/[\d.]+/g);
            if (!values || values.length < 3) return null;

            const alpha = values.length > 3 ? Number(values[3]) : 1;
            const red = Number(values[0]) * alpha + 255 * (1 - alpha);
            const green = Number(values[1]) * alpha + 255 * (1 - alpha);
            const blue = Number(values[2]) * alpha + 255 * (1 - alpha);
            return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
        }

        function getLuminanceAt(x, y) {
            const underneath = document.elementsFromPoint(x, y)
                .find((element) => !header.contains(element));

            for (let element = underneath; element && element !== document.documentElement; element = element.parentElement) {
                if (element instanceof HTMLImageElement) {
                    const luminance = getImageLuminance(element, x, y);
                    if (luminance !== null) return luminance;
                }

                const color = getColorLuminance(getComputedStyle(element).backgroundColor);
                if (color !== null && color < 0.999) return color;
            }

            return 1;
        }

        function updateHeaderContrast() {
            updateFrame = 0;

            for (const target of targets) {
                const rect = target.getBoundingClientRect();
                if (!rect.width || !rect.height) continue;

                const xPositions = [0.2, 0.5, 0.8].map((ratio) => rect.left + rect.width * ratio);
                const luminances = xPositions
                    .map((x) => getLuminanceAt(x, rect.top + rect.height / 2))
                    .filter((value) => value !== null);
                if (!luminances.length) continue;

                const luminance = luminances.reduce((sum, value) => sum + value, 0) / luminances.length;
                let tone = target.dataset.headerContrast;
                if (!tone) tone = luminance < 0.5 ? 'light' : 'dark';
                else if (tone === 'light' && luminance > 0.56) tone = 'dark';
                else if (tone === 'dark' && luminance < 0.44) tone = 'light';

                if (tone !== target.dataset.headerContrast) {
                    target.dataset.headerContrast = tone;
                    target.style.setProperty('--header-text-color', tone === 'light' ? '#f8fafc' : '#172033');
                    target.style.setProperty('--header-text-shadow', tone === 'light'
                        ? '0 1px 3px rgba(0, 0, 0, 0.7)'
                        : '0 1px 3px rgba(255, 255, 255, 0.85)');
                }
            }
        }

        function scheduleContrastUpdate() {
            if (!updateFrame) updateFrame = requestAnimationFrame(updateHeaderContrast);
        }

        window.addEventListener('scroll', scheduleContrastUpdate, { passive: true });
        window.addEventListener('resize', scheduleContrastUpdate, { passive: true });
        document.addEventListener('load', (event) => {
            if (event.target instanceof HTMLImageElement) scheduleContrastUpdate();
        }, true);
        scheduleContrastUpdate();
    }

    function initScrollProgress() {
        const progressBar = document.querySelector('.scroll-progress-bar');
        const mobileOrTablet = window.matchMedia('(max-width: 992px)');
        let frameId = 0;
        let isListening = false;

        if (!progressBar) return;

        function updateProgress() {
            frameId = 0;
            const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
            const progress = scrollableHeight > 0
                ? Math.min(1, Math.max(0, window.scrollY / scrollableHeight))
                : 0;
            progressBar.style.transform = `scaleX(${progress})`;
        }

        function scheduleProgressUpdate() {
            if (!frameId) frameId = window.requestAnimationFrame(updateProgress);
        }

        function syncProgressListener() {
            if (mobileOrTablet.matches && !isListening) {
                window.addEventListener('scroll', scheduleProgressUpdate, { passive: true });
                isListening = true;
                scheduleProgressUpdate();
            } else if (!mobileOrTablet.matches && isListening) {
                window.removeEventListener('scroll', scheduleProgressUpdate);
                isListening = false;
                window.cancelAnimationFrame(frameId);
                frameId = 0;
                progressBar.style.transform = 'scaleX(0)';
            }
        }

        mobileOrTablet.addEventListener('change', syncProgressListener);
        window.addEventListener('resize', () => {
            syncProgressListener();
            if (isListening) scheduleProgressUpdate();
        }, { passive: true });
        syncProgressListener();
    }

    function initHeroHeader() {
        const header = document.querySelector('.header');
        const hero = document.querySelector('.hero');
        let updateFrame = 0;

        if (!header || !hero) return;

        const heroStart = hero.getBoundingClientRect().top + window.scrollY;

        function updateHeaderForHero() {
            updateFrame = 0;
            const headerHeight = header.getBoundingClientRect().height;
            const heroBounds = hero.getBoundingClientRect();
            const overlapsHero = heroBounds.top < headerHeight && heroBounds.bottom > headerHeight;
            const scrollDistance = window.scrollY - heroStart;
            const scrollProgress = scrollDistance <= 1
                ? 0
                : Math.min(1, Math.max(0, scrollDistance / heroBounds.height));
            header.classList.toggle('is-over-hero', overlapsHero);
            hero.style.setProperty('--hero-scroll-shade', (Math.sqrt(scrollProgress) * 0.4).toFixed(3));
        }

        function scheduleHeaderUpdate() {
            if (!updateFrame) updateFrame = requestAnimationFrame(updateHeaderForHero);
        }

        window.addEventListener('scroll', scheduleHeaderUpdate, { passive: true });
        window.addEventListener('resize', scheduleHeaderUpdate, { passive: true });
        updateHeaderForHero();
    }

    function initKegiatanSlider() {
        const slider = document.querySelector('[data-kegiatan-slider]');
        if (!slider) return;

        const featureImage = slider.querySelector('.kegiatan-feature-image');
        const counter = slider.querySelector('.kegiatan-counter');
        const track = slider.querySelector('.kegiatan-track');
        if (!featureImage || !counter || !track) return;

        const originalIndexes = new Map(
            [...track.querySelectorAll('.kegiatan-select')].map((button, index) => [button, index])
        );
        let isAnimating = false;
        let pendingSteps = 0;
        let imageSwapTimer;

        track.querySelectorAll('.kegiatan-select').forEach((button) => {
            const preview = new Image();
            preview.src = button.dataset.image;
        });

        function setActiveCard(card) {
            const selectedButton = card.querySelector('.kegiatan-select');
            const originalIndex = originalIndexes.get(selectedButton);

            [...track.children].forEach((item) => {
                const isActive = item === card;
                item.classList.toggle('is-active', isActive);
                item.querySelector('.kegiatan-select').setAttribute('aria-pressed', String(isActive));
            });

            window.clearTimeout(imageSwapTimer);
            if (featureImage.getAttribute('src') !== selectedButton.dataset.image) {
                featureImage.classList.add('is-changing');
                imageSwapTimer = window.setTimeout(() => {
                    featureImage.src = selectedButton.dataset.image;
                    featureImage.alt = selectedButton.dataset.alt;
                    featureImage.classList.remove('is-changing');
                }, 140);
            }

            counter.textContent = `${String(originalIndex + 1).padStart(2, '0')} / ${String(originalIndexes.size).padStart(2, '0')}`;
        }

        function finishStep(direction, outgoingCard, onTransitionEnd, timer) {
            if (!isAnimating) return;

            window.clearTimeout(timer);
            track.removeEventListener('transitionend', onTransitionEnd);
            if (direction > 0) track.append(outgoingCard);

            track.style.transition = 'none';
            track.style.transform = 'translateX(0)';
            track.getBoundingClientRect();
            track.style.transition = '';
            isAnimating = false;
            requestAnimationFrame(advanceQueue);
        }

        function animateStep(direction) {
            const cards = [...track.children];
            const distance = cards[0].getBoundingClientRect().width
                + parseFloat(getComputedStyle(track).gap || 0);
            let incomingCard;
            let outgoingCard = cards[0];

            if (direction > 0) {
                incomingCard = cards[1];
            } else {
                incomingCard = cards[cards.length - 1];
                track.style.transition = 'none';
                track.prepend(incomingCard);
                track.style.transform = `translateX(${-distance}px)`;
                track.getBoundingClientRect();
            }

            setActiveCard(incomingCard);
            isAnimating = true;

            let timer;
            function onTransitionEnd(event) {
                if (event.target !== track || event.propertyName !== 'transform') return;
                finishStep(direction, outgoingCard, onTransitionEnd, timer);
            }

            track.addEventListener('transitionend', onTransitionEnd);
            timer = window.setTimeout(() => {
                finishStep(direction, outgoingCard, onTransitionEnd, timer);
            }, 500);

            requestAnimationFrame(() => {
                track.style.transform = direction > 0
                    ? `translateX(${-distance}px)`
                    : 'translateX(0)';
            });
        }

        function advanceQueue() {
            if (isAnimating || pendingSteps === 0) return;

            const direction = Math.sign(pendingSteps);
            pendingSteps -= direction;
            animateStep(direction);
        }

        function requestSteps(steps) {
            pendingSteps += steps;
            advanceQueue();
        }

        track.querySelectorAll('.kegiatan-card').forEach((card) => {
            card.querySelector('.kegiatan-select').addEventListener('click', () => {
                const index = [...track.children].indexOf(card);
                if (index > 0) requestSteps(index);
            });
        });

        slider.querySelectorAll('[data-kegiatan-step]').forEach((control) => {
            control.addEventListener('click', () => {
                requestSteps(Number(control.dataset.kegiatanStep));
            });
        });
    }

    function initScrollReveal(selector) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const revealTargets = document.querySelectorAll(selector);
        if (!revealTargets.length) return;

        const siblingGroups = new Map();
        revealTargets.forEach((element) => {
            const siblings = siblingGroups.get(element.parentElement) || [];
            siblings.push(element);
            siblingGroups.set(element.parentElement, siblings);
            element.classList.add('scroll-reveal');
        });

        siblingGroups.forEach((siblings) => {
            siblings.forEach((element, index) => {
                element.style.setProperty('--reveal-delay', `${Math.min(index * 75, 300)}ms`);
            });
        });

        const pendingTargets = new Set(revealTargets);
        let observer;
        let frameId = 0;
        let fallbackTimer = 0;

        function reveal(element) {
            element.classList.add('is-visible');
            pendingTargets.delete(element);
            observer?.unobserve(element);
        }

        if ('IntersectionObserver' in window) {
            observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) reveal(entry.target);
                });
            }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' });

            revealTargets.forEach((element) => observer.observe(element));
        }

        function checkVisibleTargets() {
            if (frameId) cancelAnimationFrame(frameId);
            frameId = 0;
            window.clearTimeout(fallbackTimer);
            fallbackTimer = 0;
            for (const element of pendingTargets) {
                const rect = element.getBoundingClientRect();
                if (rect.top < window.innerHeight - 36 && rect.bottom > 36) reveal(element);
            }
        }

        function scheduleVisibilityCheck() {
            if (frameId || fallbackTimer) return;
            frameId = requestAnimationFrame(checkVisibleTargets);
            fallbackTimer = window.setTimeout(checkVisibleTargets, 120);
        }

        window.addEventListener('scroll', scheduleVisibilityCheck, { passive: true });
        window.addEventListener('resize', scheduleVisibilityCheck, { passive: true });
        scheduleVisibilityCheck();
    }

    function initHomeReveal() {
        initScrollReveal(
            '.sambutan .section-heading, .sambutan-content, ' +
            '.tentang .section-heading, .tentang-content, ' +
            '.visi-misi .section-heading, .visi-misi-grid > *, ' +
            '.pengurus .section-heading, .pengurus-card, ' +
            '.kegiatan .section-heading, .kegiatan-visual, .kegiatan-card, .kegiatan-controls, ' +
            '.galeri .section-heading, .galeri-item, ' +
            '.berita .section-heading, .berita-card, ' +
            '.kontak .section-heading, .kontak-item'
        );
    }

    function initArticleShare() {
        const articleTitle = document.querySelector('.article-heading h1');
        const copyButton = document.querySelector('.share-copy');
        const shareStatus = document.querySelector('.share-status');
        const shareActions = document.querySelector('.share-actions');
        if (!articleTitle || !copyButton || !shareStatus || !shareActions) return;

        const shareTitle = encodeURIComponent(articleTitle.textContent.trim());
        const shareUrl = encodeURIComponent(window.location.href);
        const whatsapp = document.querySelector('[data-share="whatsapp"]');
        const facebook = document.querySelector('[data-share="facebook"]');
        const x = document.querySelector('[data-share="x"]');

        if (whatsapp) whatsapp.href = `https://wa.me/?text=${shareTitle}%20${shareUrl}`;
        if (facebook) facebook.href = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;
        if (x) x.href = `https://x.com/intent/post?text=${shareTitle}&url=${shareUrl}`;

        const shareColors = {
            'share-whatsapp': '#20c763',
            'share-facebook': '#1877f2',
            'share-x': '#111111',
            'share-copy': '#17644f'
        };

        function setShareButtonActive(button, isActive) {
            const colorClass = [...button.classList].find((className) => shareColors[className]);
            if (!colorClass) return;

            if (isActive) {
                const color = shareColors[colorClass];
                button.style.setProperty('background-color', color, 'important');
                button.style.setProperty('border-color', color, 'important');
                button.style.setProperty('color', '#ffffff', 'important');
                button.style.setProperty('transform', 'translateY(-2px)', 'important');
            } else {
                button.style.removeProperty('background-color');
                button.style.removeProperty('border-color');
                button.style.removeProperty('color');
                button.style.removeProperty('transform');
            }
        }

        shareActions.addEventListener('pointerover', (event) => {
            const button = event.target.closest('.share-actions a, .share-copy');
            if (button && shareActions.contains(button)) setShareButtonActive(button, true);
        });

        shareActions.addEventListener('pointerout', (event) => {
            const button = event.target.closest('.share-actions a, .share-copy');
            if (button && shareActions.contains(button) && !button.contains(event.relatedTarget)) {
                setShareButtonActive(button, false);
            }
        });

        shareActions.addEventListener('focusin', (event) => {
            const button = event.target.closest('.share-actions a, .share-copy');
            if (button && shareActions.contains(button)) setShareButtonActive(button, true);
        });

        shareActions.addEventListener('focusout', (event) => {
            const button = event.target.closest('.share-actions a, .share-copy');
            if (button && shareActions.contains(button) && !button.contains(event.relatedTarget)) {
                setShareButtonActive(button, false);
            }
        });

        copyButton.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(window.location.href);
                shareStatus.textContent = 'Tautan tersalin';
            } catch {
                shareStatus.textContent = 'Salin tautan dari bilah alamat browser';
            }
        });
    }

    function initArticleReveal() {
        initScrollReveal(
            '.article-breadcrumb, .article-heading, .article-cover, ' +
            '.article-summary, .article-body > p, .article-body > h2, ' +
            '.article-quote, .article-sidebar > *'
        );
    }

    function initYear() {
        const yearNode = document.getElementById('year');
        if (yearNode) yearNode.textContent = new Date().getFullYear();
    }

    initMobileMenu();
    initHeaderContrast();
    initScrollProgress();
    initHeroHeader();
    initKegiatanSlider();
    initHomeReveal();
    initArticleShare();
    initArticleReveal();
    initYear();
})();
