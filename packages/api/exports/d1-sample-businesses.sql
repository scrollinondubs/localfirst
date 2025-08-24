DELETE FROM businesses WHERE id IN (
  '5e261713-7f87-4aaa-a32b-4f9fbe178949',
  'ce81ad2f-f6e9-49b2-83fb-46699ed88bce',
  '0ba33fd2-b5eb-411b-b0c0-d6a70b3be275',
  'def125e4-4e1e-42e0-a7b5-c52689ecd7a4',
  'd84c4714-80e7-4466-a2e2-ede89afa45df'
);

INSERT INTO businesses (
        id, name, address, latitude, longitude, 
        phone, website, category, lfa_member, 
        member_since, verified, status, created_at, updated_at
      ) VALUES (
        '5e261713-7f87-4aaa-a32b-4f9fbe178949',
        '¡ A comer!',
        '8202 W Indian School Rd, Phoenix, AZ 85033',
        33.4944359,
        -112.2353147,
        '6238732400',
        'Nuevoburrito.com',
        'other',
        0,
        NULL,
        0,
        'active',
        '2025-08-11 18:48:30',
        '2025-08-11 18:48:30'
      );
INSERT INTO businesses (
        id, name, address, latitude, longitude, 
        phone, website, category, lfa_member, 
        member_since, verified, status, created_at, updated_at
      ) VALUES (
        'ce81ad2f-f6e9-49b2-83fb-46699ed88bce',
        '[POPPED] Artisan Popcorn',
        '510 N. 7th Avenue Suite 140, Tucson, AZ 85705',
        32.24522927228666,
        -111.01743786173066,
        '(520) 940-0115',
        'www.poppedartisan.com',
        'other',
        0,
        NULL,
        0,
        'active',
        '2025-08-11 18:48:30',
        '2025-08-11 18:48:30'
      );
INSERT INTO businesses (
        id, name, address, latitude, longitude, 
        phone, website, category, lfa_member, 
        member_since, verified, status, created_at, updated_at
      ) VALUES (
        '0ba33fd2-b5eb-411b-b0c0-d6a70b3be275',
        '10 to 1 Public Relations',
        '7975 N Hayden Road, Suite C-300, Scottsdale, AZ 85258',
        33.449083845521905,
        -111.97428055505173,
        '480-789-0743',
        'www.10to1pr.com',
        'professional_services',
        0,
        NULL,
        0,
        'active',
        '2025-08-11 18:48:30',
        '2025-08-11 18:48:30'
      );
INSERT INTO businesses (
        id, name, address, latitude, longitude, 
        phone, website, category, lfa_member, 
        member_since, verified, status, created_at, updated_at
      ) VALUES (
        'def125e4-4e1e-42e0-a7b5-c52689ecd7a4',
        '12 West Brewing',
        '12 W Main, Mesa, AZ 85201',
        33.435612763786125,
        -111.81937753359045,
        '480-508-7018',
        '12westbrewing.com',
        'restaurant',
        0,
        NULL,
        0,
        'active',
        '2025-08-11 18:48:30',
        '2025-08-11 18:48:30'
      );
INSERT INTO businesses (
        id, name, address, latitude, longitude, 
        phone, website, category, lfa_member, 
        member_since, verified, status, created_at, updated_at
      ) VALUES (
        'd84c4714-80e7-4466-a2e2-ede89afa45df',
        '1601 Design',
        '1425 E Portland St, Phoenix, AZ 85006',
        33.460415,
        -112.0514177,
        '4805291310',
        '1601design.com',
        'professional_services',
        0,
        NULL,
        0,
        'active',
        '2025-08-11 18:48:30',
        '2025-08-11 18:48:30'
      );