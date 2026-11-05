-- The compere role used to be saved as mc: staff saved with the old role (and the sample account) are renamed
UPDATE `staff_users` SET `role` = 'compere' WHERE `role` = 'mc';--> statement-breakpoint
UPDATE `staff_users` SET `username` = 'compere@sample.example' WHERE `username` = 'mc@sample.example';
