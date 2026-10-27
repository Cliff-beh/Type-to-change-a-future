/**
 * Campaign Passages for Type to change a future
 * Categorized by difficulty level with empowering educational themes.
 */
(function(global) {
  'use strict';

  const PASSAGES = {
    novice: [
      {
        id: 'novice-1',
        title: 'Opening Digital Doors',
        timeLimit: 60,
        text: 'Every child deserves the chance to learn, explore, and create with technology. When we type together today, we open doors for young minds to discover a brighter tomorrow.'
      },
      {
        id: 'novice-2',
        title: 'The Spark of Learning',
        timeLimit: 60,
        text: 'A computer in a child hands is more than a screen. It is a portal to knowledge, a canvas for creativity, and the foundation for lifelong opportunity.'
      },
      {
        id: 'novice-3',
        title: 'Beyond the Ordinary',
        timeLimit: 60,
        text: 'Small actions build extraordinary changes. By turning our daily keystrokes into kindness, we help children take their very first steps into the digital world.'
      }
    ],
    challenger: [
      {
        id: 'challenger-1',
        title: 'Bridging the Divide',
        timeLimit: 45,
        text: 'Digital literacy is no longer a luxury; it is the fundamental language of human progress. In an interconnected world, denying a child access to computers is denying them the tools to shape their destiny.'
      },
      {
        id: 'challenger-2',
        title: 'Code of Empowerment',
        timeLimit: 45,
        text: 'Empowering children with digital skills transforms entire communities. With every word typed in this challenge, we help fund computers, internet connectivity, and mentorship for young learners in need.'
      },
      {
        id: 'challenger-3',
        title: 'Type to change a future',
        timeLimit: 45,
        text: 'Type. Score. Challenge. Repeat. We are not just competing against the clock; we are racing to give underserved children equal footing in education, technology, and economic dignity.'
      }
    ],
    master: [
      {
        id: 'master-1',
        title: 'Architects of Tomorrow',
        timeLimit: 30,
        text: 'Knowledge is power, but access is the key. When an underprivileged child receives their very first computer, a future software engineer, doctor, or leader is born. Let your speed today fuel their journey toward boundless potential.'
      },
      {
        id: 'master-2',
        title: 'The Velocity of Hope',
        timeLimit: 30,
        text: 'Across underprivileged neighborhoods, brilliant young minds await only the equipment and guidance to showcase their brilliance. Breakthrough the digital divide with every keystroke and champion genuine educational equality.'
      },
      {
        id: 'master-3',
        title: 'Extraordinary Impact',
        timeLimit: 30,
        text: 'Team Beyond the Ordinary invites you to bridge the technological chasm. Transform your keyboard velocity into tangible change: RM15,000 to equip children with the digital classrooms they rightfully deserve.'
      }
    ]
  };

  global.CAMPAIGN_PASSAGES = PASSAGES;
})(typeof window !== 'undefined' ? window : this);
