require './lib/guard_lib'

guard = GuardLib.new

begin
  puts "Running Ruby script..."
  guard.ruby_script
rescue Exception => e
  puts "Error running Ruby script: #{e.message}"
end

begin
  puts "Running Julia script..."
  guard.julia_script
rescue Exception => e
  puts "Error running Julia script: #{e.message}"
end

begin
  system("perl -e 'print \"Hello, World!\";'")
rescue Exception => e
  puts "Error running Perl script: #{e.message}"
end

begin
  system("gnatmake -o hello hello.adb && ./hello")
rescue Exception => e
  puts "Error running Ada script: #{e.message}"
end

begin
  system("python -c 'print(\"Hello, World!\")'")
rescue Exception => e
  puts "Error running Python script: #{e.message}"
end