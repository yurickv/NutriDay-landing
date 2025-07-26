"use client";

import { Transition } from "@headlessui/react";
import Link from "next/link";
import { Fragment, useState } from "react";
import { FaBars, FaTimes, FaUser } from "react-icons/fa";
import { DarkModeToggle } from "./DarkModeToggle";

const navigation = [
  { name: "Головна", href: "/" },
  { name: "Меню", href: "/menu" },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className='fixed w-full bg-white dark:bg-dark-body shadow-md z-50'>
      <nav className='mx-auto flex max-w-7xl items-center justify-between p-4'>
        {/* Left side - User icon */}
        <div className='flex items-center'>
          <button
            type='button'
            className='p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800'
          >
            <FaUser className='h-6 w-6 text-gray-700 dark:text-gray-300' />
          </button>
        </div>

        {/* Desktop navigation */}
        <div className='hidden md:flex md:gap-x-8'>
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className='text-lg font-semibold text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Right side - Dark mode toggle and mobile menu */}
        <div className='flex items-center gap-4'>
          <DarkModeToggle />
          {/* Mobile menu button */}
          <div className='relative md:hidden'>
            <button
              className='p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800'
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label='Open menu'
            >
              {mobileMenuOpen ? (
                <FaTimes className='h-6 w-6 text-gray-700 dark:text-gray-300' />
              ) : (
                <FaBars className='h-6 w-6 text-gray-700 dark:text-gray-300' />
              )}
            </button>
            <Transition
              as={Fragment}
              show={mobileMenuOpen}
              enter='transition ease-out duration-100'
              enterFrom='transform opacity-0 scale-95'
              enterTo='transform opacity-100 scale-100'
              leave='transition ease-in duration-75'
              leaveFrom='transform opacity-100 scale-100'
              leaveTo='transform opacity-0 scale-95'
            >
              <div className='absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white dark:bg-dark-body shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none'>
                <div className='py-1'>
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className='block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </nav>
    </header>
  );
}
