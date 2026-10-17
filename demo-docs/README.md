# Demo documents

Sample files for the demo (all invented, for the fictional Northwind Air). Upload them on the "How can we help?" page:

- `delay_email.txt`: Northwind's email saying NW182 arrived at 15:05 instead of 11:10 for "operational reasons".
- `boarding_pass.png`: the boarding pass (an image, read by a vision model).
- `cafe_receipt.pdf`: a £18.20 cafe receipt from the delay (a PDF).

Counterbot reads each one, pulls out the facts (booking K7P2QD, flight NW182, the times, the airline's reason), and fetches Northwind's published policy from `/northwind/policy/`.
