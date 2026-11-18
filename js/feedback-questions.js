/* Everything a student reads or answers in the feedback system: the consent dialog, the optional profile,
   the per-example card and the course survey. Edit questions here; the site, the Google Sheet columns and the
   optional Google Form (node tools/build_form.js) all follow this file.

   Question types: 'scale' (1..max with low/high labels), 'choice' (pick one), 'multi' (pick any),
   'text' (one line), 'longtext' (paragraph). Every question is optional. Keep ids stable: they become
   column names in the Sheet. Bump consent.version whenever the consent wording changes; everyone is asked again. */
(function () {
  'use strict';
  const LEVEL = ['Not at all', 'A little', 'Comfortable', 'Very comfortable'];

  window.PDC.FEEDBACK_QUESTIONS = {
    consent: {
      version: 1,
      label: 'Open Core Lab',
      title: 'Help us improve the examples',
      intro: 'We are the course team, and we would love to know which animations help and which need work. Is it okay if we collect some anonymous information while you use the site?',
      points: [
        'This covers which examples you open, roughly how long you spend on them, your browser and device type, and any ratings or comments you send.',
        'It is anonymous: no names, emails or IP addresses. Only the course team sees it.',
        'You can change your mind any time under <a href="#/privacy">Privacy &amp; data</a> in the sidebar.'
      ],
      choices: {
        full: { label: 'Sure, share usage and feedback', help: 'Usage info plus anything you send' },
        feedback: { label: 'Only feedback I send', help: 'Ratings and comments, nothing else' },
        none: { label: 'No thanks', help: 'We just count that someone said no' }
      },
      adultNote: 'Choosing “Sure” confirms you are 18 or older.',
      under18Link: 'Under 18?',
      ages: [
        { v: '18+', label: '18 or older', note: '' },
        { v: '13-17', label: '13 to 17', note: 'You are welcome to send feedback; we just will not record usage.' },
        { v: 'under13', label: 'Under 13', note: 'Thanks for checking! Enjoy the site; we will not collect anything.' }
      ]
    },

    /* asked once, right after "Sure", and editable from the Privacy & data page */
    profile: {
      title: 'A little about you',
      intro: 'All optional. It helps us see who the examples work for.',
      questions: [
        { id: 'level', type: 'choice', label: 'You are a…', options: ['High school student', 'Undergraduate', 'Master’s student', 'PhD student', 'Working professional', 'Learning on my own', 'Other'] },
        { id: 'course', type: 'choice', label: 'Which course are you using this for?', options: ['PDC', 'HPML', 'Both', 'Neither, just curious'] },
        { id: 'exp_c', type: 'choice', label: 'How comfortable are you with C or C++?', options: LEVEL },
        { id: 'exp_parallel', type: 'choice', label: 'With parallel programming (threads, OpenMP, MPI, CUDA)?', options: LEVEL },
        { id: 'exp_ml', type: 'choice', label: 'With machine learning frameworks (PyTorch, TensorFlow, JAX)?', options: LEVEL },
        { id: 'region', type: 'choice', label: 'Where are you studying from?', options: ['North America', 'Central America & Caribbean', 'South America', 'Europe', 'Africa', 'Middle East', 'South Asia', 'East Asia', 'Southeast Asia', 'Oceania', 'Prefer not to say'] },
        { id: 'run_where', type: 'choice', label: 'Where do you usually compile and run the course code?', options: ['My own computer', 'University lab machines', 'University cluster / HPC', 'Cloud (Colab, etc.)', 'I don’t run it'] }
      ]
    },

    /* the small card that appears when a student reaches the last step of an example */
    example: {
      title: 'Did this example help?',
      questions: [
        { id: 'helpful', type: 'scale', max: 5, label: 'How much did the animation help you understand it?', low: 'Not at all', high: 'A lot' },
        { id: 'code_level', type: 'choice', label: 'The source code was…', options: ['Too easy', 'About right', 'Challenging', 'Too hard'] },
        { id: 'comment', type: 'text', max: 500, label: 'Anything confusing or missing? (optional)' }
      ]
    },

    /* the course survey at #/feedback */
    survey: {
      title: 'Course feedback',
      intro: 'A few minutes of your thoughts on Open Core Lab. Every question is optional.',
      questions: [
        { id: 'overall', type: 'scale', max: 5, label: 'Overall, how useful is Open Core Lab for your learning?', low: 'Not useful', high: 'Very useful' },
        { id: 'vs_slides', type: 'choice', label: 'Compared with lecture slides alone, the animations make the concepts…', options: ['Harder to follow', 'About the same', 'A bit easier', 'Much easier'] },
        { id: 'pace', type: 'choice', label: 'The step-by-step pace is…', options: ['Too slow', 'About right', 'Too fast'] },
        { id: 'code_overall', type: 'choice', label: 'Overall, the course source code is…', options: ['Too easy', 'About right', 'Challenging', 'Too hard'] },
        { id: 'features', type: 'multi', label: 'Which features did you use?', options: ['Step buttons / arrow keys', 'Autoplay', 'Clicking highlighted code lines', 'Sidebar search', 'Dark mode', '“Try it” ideas', 'View on GitHub'] },
        { id: 'best', type: 'text', max: 300, label: 'Which example or topic helped you most?' },
        { id: 'hardest', type: 'text', max: 300, label: 'Which topic was still hard to understand, even with the animation?' },
        { id: 'recommend', type: 'scale', max: 5, label: 'How likely are you to recommend Open Core Lab to a classmate?', low: 'Unlikely', high: 'Very likely' },
        { id: 'wish', type: 'longtext', max: 2000, label: 'What should we add or improve?' }
      ]
    }
  };
})();
