// NLP Sentiment Analysis - Mock Social Media Feed Data
// Used to simulate live, real-time incoming commentary streams across different sectors.

const mockStreams = {
  tech: [
    { text: "Wow! The new display is absolutely outstanding. Colors are incredible! 😍", user: "@tech_enthusiast" },
    { text: "Highly disappointed with the battery life. It barely lasts half a day under normal use. Avoid.", user: "@mobile_user99" },
    { text: "The camera zoom works okay, but the low light performance is terrible and very noisy.", user: "@photo_lens" },
    { text: "This new AI assistant is extremely helpful. Smooth transitions and perfect voice recognition!", user: "@ai_forward" },
    { text: "It's fine. Nothing revolutionary, just a minor upgrade from last year's model.", user: "@gadget_reviewer" },
    { text: "My device crashed twice during set up. Horrible onboarding experience. 😡", user: "@angry_buyer" },
    { text: "The carbon footprint is reduced! Great initiative and beautiful design.", user: "@eco_tech" },
    { text: "So expensive! Not worth the high price tag unless you are a die-hard fan.", user: "@wallet_watch" },
    { text: "The software is incredibly clean and fast. Excellent work by the development team!", user: "@code_ninja" },
    { text: "Face unlock is slightly slower than expected, but overall it is a solid package.", user: "@tester_beta" },
    { text: "No headphone jack? Seriously? That is a huge defect. Very annoying.", user: "@audio_geek" },
    { text: "The charger in the box is missing. What a complete scam. Worst customer care ever.", user: "@unhappy_consumer" },
    { text: "Stellar performance! Played games for hours and it stayed cool.", user: "@gamer_hq" },
    { text: "The keyboard feel is decent. Not amazing, but acceptable.", user: "@writer_pro" },
    { text: "It's an okay gadget. Definitely does the job, but it is super overpriced.", user: "@smart_shopper" }
  ],
  food: [
    { text: "The pizza was absolutely delicious! Perfect crust and fresh toppings. 🍕❤️", user: "@foodie_exp" },
    { text: "Worst delivery service. Food arrived two hours late and it was completely cold and ruined.", user: "@hungry_tony" },
    { text: "Decent burger. The fries were a bit stale but the service was friendly.", user: "@lunch_critic" },
    { text: "The sushi was incredibly fresh and beautifully presented. Highly recommend this spot! 🍣", user: "@sushi_lover" },
    { text: "Very noisy restaurant and extremely slow service. The waiter was not helpful at all.", user: "@dinout_9" },
    { text: "Average taste. Safe option, but nothing to write home about.", user: "@simple_eats" },
    { text: "Terrible stomach ache after eating here. Abysmal hygiene standards. 🤢🚨", user: "@safefood_adv" },
    { text: "Super cozy place with great music and sweet desserts. Fantastic experience!", user: "@date_night_guide" },
    { text: "The chicken was dry and poorly seasoned. A waste of money.", user: "@bbq_rating" },
    { text: "Quick delivery and very clean packaging. Extremely satisfied!", user: "@office_luncher" },
    { text: "The menu is limited but everything we ordered was excellent.", user: "@gourmet_journal" },
    { text: "I hate the new recipe. It tastes weird and too salty.", user: "@loyal_diner" },
    { text: "An absolute culinary masterpiece! Every dish exceeded our expectations.", user: "@chef_review" },
    { text: "Ok noodles. Portions are solid, but price is quite high.", user: "@noodle_hunter" },
    { text: "The soup was warm and peaceful. Lovely staff.", user: "@soup_comfort" }
  ],
  movies: [
    { text: "A breathtaking cinematic masterpiece! The acting was outstanding and the music was stellar. 🎬⭐", user: "@cinema_buff" },
    { text: "What a boring movie. I literally fell asleep in the middle. Totally waste of time.", user: "@popcorn_nap" },
    { text: "The plot was extremely predictable and the dialogue was atrocious.", user: "@script_critic" },
    { text: "Incredibly fun and action-packed! The visual effects were magnificent.", user: "@hero_fanatic" },
    { text: "It's okay. Nice acting by the lead, but the pacing was very slow.", user: "@cinephile_x" },
    { text: "Horrible screenplay. A complete disaster from start to finish. Avoid!", user: "@film_flop" },
    { text: "The cinematography was beautiful, but the storyline lacked depth and felt empty.", user: "@visual_junkie" },
    { text: "Exceeded all expectations! The plot twist was brilliant and extremely shocking.", user: "@twist_finder" },
    { text: "Dull characters and terrible CGI. Worst movie of the year. 🤮", user: "@honest_reviews" },
    { text: "Loved the chemistry between the main characters. A delightful romantic comedy!", user: "@romcom_fan" },
    { text: "A moderate success. It is fine for a one-time watch, but nothing special.", user: "@casual_viewer" },
    { text: "The horror elements were so cheap and not scary. Extremely disappointing.", user: "@scare_meter" },
    { text: "Spectacular performances! An emotional roller coaster that is completely worth seeing.", user: "@theater_goer" },
    { text: "Stupid ending that made no sense. It ruined the entire movie experience.", user: "@ending_hater" },
    { text: "Decent adaptation of the book. Solid effort by the director.", user: "@novel_reader" }
  ],
  ecommerce: [
    { text: "Excellent product! Easy to assemble, very durable and fits perfectly. 👍", user: "@happy_buyer_22" },
    { text: "Scam! The item is defective and does not match the description. Customer service is useless.", user: "@scammed_customer" },
    { text: "The quality is decent for the price. Fast shipping and secure packaging.", user: "@daily_deals" },
    { text: "Absolutely gorgeous dress! Fabric feels super soft and high-quality.", user: "@fashion_queen" },
    { text: "Broken on arrival! Extremely fragile material. Horrible quality. 😡❌", user: "@fragile_goods" },
    { text: "It is fine. It does what it is supposed to do. Average value.", user: "@practical_man" },
    { text: "Amazing customer support! They resolved my shipping issue in five minutes. Outstanding!", user: "@service_fan" },
    { text: "Highly expensive for such a small size. A bit disappointed.", user: "@budget_shopper" },
    { text: "The color is slightly different from the photos, but it is still beautiful and comfortable.", user: "@interior_decor" },
    { text: "Safe and reliable transaction. Item works perfectly out of the box.", user: "@gadget_buyer" },
    { text: "This item is complete garbage. It fell apart after one day. Worst purchase ever.", user: "@never_again" },
    { text: "Innovative design and very useful features. I recommend it to everyone!", user: "@daily_helper" },
    { text: "The manual is difficult to read, but the product itself is good and solid.", user: "@diy_builder" },
    { text: "Very comfortable, cozy fit. Fast delivery. Excellent purchase!", user: "@runner_101" },
    { text: "It's an ok product. Not great, but acceptable for occasional use.", user: "@weekend_warrior" }
  ]
};

// Export to window
window.MOCK_STREAMS = mockStreams;
