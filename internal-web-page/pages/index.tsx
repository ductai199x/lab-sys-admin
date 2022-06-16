import type { NextPage } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import styles from '../styles/Home.module.css'

const Home: NextPage = () => {
  return (
    <div className={styles.container}>
      <Head>
        <title>Welcome to MISL Lab</title>
        <meta name="description" content="MISL Lab Home Page" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Welcome to <a href="https://misl.ece.drexel.edu/">MISL Lab @ Drexel University</a>
        </h1>

        <div className={styles.grid}>
          <a href="lab-status" className={styles.card}>
            <h2>Lab Machine Status</h2>
            <p>A page detailing the statuses of the lab`&apos;`s machines</p>
          </a>

         
        </div>
      </main>

      <footer className={styles.footer}>
        <a
          href="https://vercel.com?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by{' '}
          <span className={styles.logo}>
            <Image src="/vercel.svg" alt="Vercel Logo" width={72} height={16} />
          </span>
        </a>
      </footer>
    </div>
  )
}

export default Home
